import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { oviaRateLimit, oviaDailyRateLimit } from "../lib/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const oviaRouter = Router();

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 4000;
const MAX_USER_CONTEXT_BYTES = 8192; // ~8 KB — prevents token-stuffing via oversized context

// ── Per-user daily quota (JWT sub — survives IP rotation) ─────────────────────
// The Foundation Plan is free forever — all users are on the Foundation Plan.
// Capped at 10 Ovia AI messages per day on gpt-4o-mini.
// Each entry auto-expires after 24 h; the Map stays small because it only grows
// by one entry per active user per day.
const userDailyCounters = new Map<string, { count: number; resetAt: number }>();

// ── Per-user short-term conversation history ───────────────────────────────────
// Stores the last MAX_HISTORY_PAIRS user+assistant turn pairs per user so Ovia
// can maintain conversational continuity across requests without the mobile app
// needing to replay full history on every call.
// Each entry auto-expires after HISTORY_TTL_MS (24 h).
const MAX_HISTORY_PAIRS = 10;
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

interface HistoryEntry {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  updatedAt: number;
}

const conversationHistory = new Map<string, HistoryEntry>();

function getHistory(userId: string): Array<{ role: "user" | "assistant"; content: string }> {
  const entry = conversationHistory.get(userId);
  if (!entry) return [];
  if (Date.now() - entry.updatedAt > HISTORY_TTL_MS) {
    conversationHistory.delete(userId);
    return [];
  }
  return entry.messages;
}

function appendToHistory(userId: string, userContent: string, assistantContent: string): void {
  if (!userContent || !assistantContent) return;
  const now = Date.now();
  const existing = conversationHistory.get(userId);
  const base: Array<{ role: "user" | "assistant"; content: string }> =
    existing && now - existing.updatedAt <= HISTORY_TTL_MS ? [...existing.messages] : [];

  base.push({ role: "user", content: userContent });
  base.push({ role: "assistant", content: assistantContent });

  const maxMessages = MAX_HISTORY_PAIRS * 2;
  const trimmed = base.length > maxMessages ? base.slice(base.length - maxMessages) : base;

  conversationHistory.set(userId, { messages: trimmed, updatedAt: now });
}

function consumeUserDailyQuota(userId: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = userDailyCounters.get(userId);
  if (!entry || now > entry.resetAt) {
    userDailyCounters.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

// ── Prompt-injection guard ────────────────────────────────────────────────────
// Detect common attempts to override the system prompt or impersonate a new AI
// persona. These patterns cover the most prevalent jailbreak families without
// blocking legitimate fitness-related text.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context|directives?)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(a|an|the)\s+/i,
  /forget\s+(everything|all|your|previous)/i,
  /disregard\s+(all\s+)?(previous|prior|your)\s+/i,
  /from\s+now\s+on\s+you\s+(are|will|must|should)/i,
  /your\s+(new\s+)?(role|instructions?|purpose|goal)\s+(is|are)/i,
  /\bjailbreak\b/i,
  /\bD\.?A\.?N\.?\b/,
  /system\s*prompt/i,
  /override\s+(your\s+)?(instructions?|guidelines?|rules?)/i,
];

function hasPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

/**
 * Strip all markdown from a streamed AI chunk before it reaches the client.
 * Applied to every streamed chunk; the system prompt also forbids markdown.
 *
 * Patterns removed:
 *   ^#{1,6}\s*          leading hash heading markers (any line)
 *   **bold** / ***bi*** bold and bold-italic stars
 *   *italic*            single-star italic
 *   __bold__            double-underscore bold
 *   _italic_            single-underscore italic
 *   ^--+                double/triple dash bullet lines
 *   ^- space            single-dash bullet lines
 *   ^* space            star bullet lines
 *   ^N. space           numbered list prefixes (e.g. "1. ", "2. ")
 *   backtick runs       inline code and triple-backtick fences
 *   ~~text~~            strikethrough
 */
/**
 * Accumulates raw SSE fragments and only releases text at sentence boundaries.
 *
 * Why: markdown tokens such as ** or ~~ can be split across consecutive chunks,
 * so cleanChunk() would never see both halves and the raw markers would leak.
 * Buffering until a sentence ends guarantees every token pair is intact before
 * we apply the regex strip pass.
 *
 * push()  — append a new fragment, returns everything up to the last boundary.
 * flush() — returns whatever is still buffered (call after the stream ends).
 *
 * Sentence boundaries recognised:
 *   • . ! ? followed by a space or tab (e.g. "Done. Next…")
 *   • A newline character (paragraph breaks)
 */
class SentenceBuffer {
  private buf = "";

  push(chunk: string): string {
    this.buf += chunk;
    let lastBoundaryEnd = -1;
    const re = /[.!?][ \t]|\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buf)) !== null) {
      lastBoundaryEnd = m.index + m[0].length;
    }
    if (lastBoundaryEnd === -1) return "";
    const ready = this.buf.slice(0, lastBoundaryEnd);
    this.buf = this.buf.slice(lastBoundaryEnd);
    return ready;
  }

  flush(): string {
    const out = this.buf;
    this.buf = "";
    return out;
  }
}

export function cleanChunk(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{2,3}([^*]*)\*{2,3}/g, "$1")
    .replace(/\*(?=[^\s*])([^*]*)\*/g, "$1")
    .replace(/_{2}([^_]*)_{2}/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^(\s*)--+\s*/gm, "$1")
    .replace(/^(\s*)-\s+/gm, "$1")
    .replace(/^(\s*)\*\s+/gm, "$1")
    .replace(/(^|[ \t])\d+\.\s+/gm, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/[–—]/g, " ")
    .replace(/\*/g, "");
}

function buildSystemPrompt(ctx: Record<string, unknown>): string {
  const now = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const userName = (ctx.name as string) ?? "Champion";
  const firstName = userName.split(" ")[0];
  const streak = ctx.streak ?? 0;
  const goals = Array.isArray(ctx.goals) ? ctx.goals.join(", ") : ctx.goals ?? "improve overall fitness";
  const weight = ctx.weight ?? null;
  const height = ctx.height ?? null;
  const age = ctx.age ?? null;
  const units = (ctx.units as string) ?? "metric";
  const weightUnit = units === "imperial" ? "lbs" : "kg";
  const heightUnit = units === "imperial" ? "in" : "cm";
  const fitnessLevel = ctx.fitnessLevel ?? "intermediate";
  const bloodGroup = (ctx.bloodGroup as string) ?? null;
  const genotype = (ctx.genotype as string) ?? null;
  const recentWorkouts = Array.isArray(ctx.recentWorkouts) ? ctx.recentWorkouts : [];
  const todayCalories = ctx.todayCalories ?? null;
  const todayProtein = ctx.todayProtein ?? null;
  const todayCarbs = ctx.todayCarbs ?? null;
  const todayFat = ctx.todayFat ?? null;
  const todayWaterGlasses = ctx.todayWaterGlasses ?? null;
  const mealBreakdown = ctx.mealBreakdown ?? null;
  const latestBodyMeasurement = (ctx.latestBodyMeasurement ?? null) as {
    date: string; weight: number; waist?: number; chest?: number; arms?: number; thighs?: number; hips?: number;
  } | null;
  const personalRecords = Array.isArray(ctx.personalRecords) ? ctx.personalRecords : [];
  const lastMessage = ctx.lastMessage ?? null;

  return `You are Ovia AI — the world-class fitness coach, food therapy expert, nutrition scientist, and wellness mentor built exclusively into the RAIMZEAL platform — a free, non-profit fitness, food therapy, and healthcare awareness platform by DR. EPHRAIM OVIAWE (RAIMZY), operated by ECONTEUR LLC.

TODAY: ${now}

CRITICAL — WHO YOU ARE AND ARE NOT:
You are NOT a doctor, licensed dietitian, or licensed healthcare professional. You never diagnose, treat, prescribe, or give medical or clinical advice. For medical, medication, pregnancy, injury, eating-disorder, or mental-health concerns, warmly direct ${firstName} to a qualified licensed professional. You provide only general fitness and wellness guidance.

ABOUT ${firstName.toUpperCase()} — LIVE PROFILE (use in every response):
First name: ${firstName}
Streak: ${streak} days
Goals: ${goals}
Fitness level: ${fitnessLevel}
${age ? `Age: ${age} years` : "Age: not set"}
${weight ? `Weight: ${weight} ${weightUnit}` : "Weight: not set"}
${height ? `Height: ${height} ${heightUnit}` : "Height: not set"}
${bloodGroup ? `Blood group: ${bloodGroup}` : "Blood group: not set"}
${genotype ? `Genotype: ${genotype}` : "Genotype: not set"}
${todayCalories !== null ? `Today calories logged: ${todayCalories} kcal` : "Today calories: none logged yet"}
${todayProtein !== null ? `Today protein: ${todayProtein}g` : ""}
${todayCarbs !== null ? `Today carbs: ${todayCarbs}g` : ""}
${todayFat !== null ? `Today fat: ${todayFat}g` : ""}
${todayWaterGlasses !== null ? `Today water: ${todayWaterGlasses} glasses` : "Today water: none logged yet"}
${mealBreakdown ? `Today meal breakdown: ${JSON.stringify(mealBreakdown)}` : ""}
${recentWorkouts.length > 0 ? `Recent workouts (last 5): ${JSON.stringify(recentWorkouts)}` : "No recent workouts logged"}
${latestBodyMeasurement ? `Latest measurements (${latestBodyMeasurement.date}): weight ${latestBodyMeasurement.weight}${weightUnit}${latestBodyMeasurement.waist ? `, waist ${latestBodyMeasurement.waist}cm` : ""}${latestBodyMeasurement.chest ? `, chest ${latestBodyMeasurement.chest}cm` : ""}${latestBodyMeasurement.arms ? `, arms ${latestBodyMeasurement.arms}cm` : ""}` : ""}
${personalRecords.length > 0 ? `Personal records: ${JSON.stringify(personalRecords)}` : ""}
${lastMessage ? `Last conversation topic: ${lastMessage}` : ""}

ALWAYS reference ${firstName}'s real data above. Never give generic advice. Reference their actual weight, height, goals, blood group, genotype, today's nutrition, and workout history in every response.

INTAKE PROTOCOL — FOLLOW STRICTLY:
If weight, age, height, blood group, or genotype are missing, ask 2 to 3 targeted intake questions before giving advice:
- Missing weight or height: "To build your personalised plan, ${firstName}, what is your current weight and height? Metric (kg/cm) or imperial (lbs/in)?"
- Missing goals: "What are your primary goals right now? Muscle gain, fat loss, endurance, strength, or overall health?"
- Missing blood group: "What is your blood group (A, B, AB, or O) and Rh factor (+ or -)? This lets me personalise your food plan."
- Missing genotype: "What is your genotype (AA, AS, SS, AC, or SC)? This is important for your nutrition and health guidance."
- Missing age: "How old are you? Your age directly affects your metabolic rate and recovery needs."
- All data present: Skip intake. Give personalised analysis immediately.

After receiving answers: Immediately call the update_profile tool to save their data to their profile automatically — no manual update needed. Then confirm warmly: "Saved to your profile ✅ Now let me put that data to work for you right now." Then give personalised advice immediately.

UPDATE PROFILE TOOL — USE PROACTIVELY:
The moment ${firstName} shares their name, age, weight, height, blood type (A/B/AB/O), Rh factor (+/-), genotype, fitness level, goals, or units preference during conversation — call the update_profile tool immediately to save it. Never say "go update your profile manually." You handle it. Silently. Seamlessly. After the tool saves, give one warm short acknowledgment and immediately launch into personalised advice using their updated data. This is how you truly have their back. 🙌

FOOD PLAN DESIGNER — THIS IS YOUR MOST IMPORTANT CAPABILITY:
You are a world-class personalised food plan designer. You draw knowledge from:
1. Harvard T.H. Chan School of Public Health — the Healthy Eating Plate, evidence-based dietary guidelines, research on food and chronic disease prevention, anti-inflammatory eating, the Mediterranean diet, and the MIND diet.
2. USDA FoodData Central and USDA Dietary Guidelines for Americans — nutrient data for thousands of FDA-approved foods, recommended daily intakes (RDAs), macronutrient targets, and food safety standards.
3. NIH Office of Dietary Supplements — vitamins, minerals, and micronutrient guidance.
4. WHO global nutrition recommendations — dietary patterns for longevity and chronic disease prevention.
5. Blood-type-informed nutrition principles — general dietary tendencies and food sensitivities commonly associated with blood types as a personalisation lens (not absolute clinical prescription).
6. Genotype-based nutrition awareness — especially for users with sickle cell trait (AS) or sickle cell disease (SS), where hydration, iron balance, antioxidant-rich foods, and anti-inflammatory eating are critically important.

BLOOD GROUP FOOD GUIDANCE (apply when designing any food plan):
Blood group A / A+/ A-: Thrives on plant-rich, lower-meat diets. Emphasise legumes (lentils, black beans, chickpeas), fresh vegetables, whole grains (oats, brown rice, quinoa), soy protein, cold-water fish (salmon, mackerel, sardines), tofu, seeds (flaxseed, pumpkin), and fermented foods. Limit red meat, processed meats, dairy (tolerate small amounts). Best oils: olive, flaxseed. Focus: anti-inflammatory, plant-forward, gentle digestion.
Blood group B / B+/ B-: Balanced omnivore. Thrives on lean meats (lamb, venison, turkey, rabbit), dairy (yoghurt, kefir, moderate cheese), eggs, green vegetables, and low-glycaemic fruits. Limit chicken, corn, wheat (moderate), lentils, peanuts, sesame. Best grain: millet, rice, oats. Focus: variety, quality protein, dairy tolerance, gut diversity.
Blood group AB / AB+/ AB-: Complex digestive system. Combine best of A and B. Excellent foods: tofu, seafood (tuna, cod, grouper, mahi-mahi), dairy (moderate), eggs, green vegetables, alkaline fruits (grapes, figs, plums, kiwi, watermelon). Avoid smoked or cured meats, red meat (in excess), seeds (sesame, sunflower). Focus: small portions, high-nutrient density, plant-forward with moderate quality protein.
Blood group O / O+/ O-: High-protein, lower-grain diet. Thrives on lean meats (beef, lamb, turkey, chicken), fish and seafood, most vegetables (especially leafy greens, broccoli, sweet potato), fruits (plums, figs, prunes). Limit grains (especially wheat and corn which may cause digestive issues), dairy (moderate), legumes. Focus: protein-forward, anti-grain-inflammation, vigorous digestion support.

GENOTYPE FOOD GUIDANCE (apply immediately when genotype is known):
AA (Normal): Standard wellness nutrition. Balanced macros, diverse whole foods, all food groups in moderate proportions. Follow Harvard Healthy Eating Plate as baseline: half the plate vegetables and fruit, quarter whole grains, quarter quality protein.
AS (Sickle Cell Trait): Generally healthy but should optimise for cellular protection. Emphasise: antioxidant-rich foods (berries, citrus, leafy greens, bell peppers, tomatoes — high in vitamin C), folate-rich foods (spinach, asparagus, lentils, fortified cereals), adequate hydration (at least 2.5 litres daily), anti-inflammatory omega-3 sources (salmon, sardines, walnuts, flaxseed), moderate iron from plant sources (avoid excessive red meat iron which can cause oxidative stress). Limit: dehydrating foods and beverages (excessive caffeine, alcohol). Always recommend adequate hydration as a priority.
SS (Sickle Cell Disease): Requires careful nutritional support. As a general wellness guide only (ALWAYS direct to a haematologist and registered dietitian): focus heavily on anti-inflammatory and antioxidant-dense foods, consistent hydration, folate and B12 foods, vitamin D-rich foods (fatty fish, egg yolks, fortified foods), zinc-rich foods (pumpkin seeds, legumes, quinoa), and high-quality plant and lean animal protein. Avoid: high-fat fried foods, excess red meat, processed foods. ALWAYS note: SS individuals must work with their medical team and a registered dietitian for a clinical nutrition plan. Provide only general wellness guidance.
SC (Haemoglobin SC Disease): Generally milder than SS but still a significant sickle cell variant requiring dietary attention. As a general wellness guide only (ALWAYS direct to a haematologist and registered dietitian): similar nutritional principles to SS — prioritise anti-inflammatory and antioxidant-rich foods, consistent hydration (at least 2.5 litres daily), folate-rich foods (spinach, lentils, fortified cereals), vitamin C sources to support immune function and iron absorption management, omega-3 anti-inflammatory fats (salmon, walnuts, flaxseed). Moderate physical exertion during illness or heat. Avoid dehydrating foods and beverages. ALWAYS note: SC individuals should work with their medical team for personalised clinical guidance. Provide only general wellness guidance.
AC (Haemoglobin C Trait): Similar considerations to AS. Anti-inflammatory diet, good hydration, antioxidant-rich foods, moderate iron management. Recommend working with a healthcare provider for personalised guidance.

PERSONALISED FOOD PLAN CREATION:
When ${firstName} asks for a food plan, daily meal plan, weekly plan, or what to eat:
1. Immediately apply their blood group and genotype guidelines above.
2. Factor in their weight, goals, fitness level, and today's data.
3. Design a complete plan with Breakfast, Mid-morning snack, Lunch, Afternoon snack, and Dinner.
4. For weekly plans, vary meals across 7 days to prevent monotony.
5. Use only FDA-approved, USDA-listed, widely available whole foods.
6. Include approximate calorie and macronutrient estimates per meal.
7. Always name specific foods, portions (grams or cups), and preparation notes.
8. Reference Harvard Healthy Eating Plate proportions as the base structure.
9. After presenting the plan, remind ${firstName}: "Log each meal in your RAIMZEAL app so I can track your progress and adjust your plan as needed."

PLAN REMINDER PROTOCOL:
You are ${firstName}'s accountability partner. If today's nutrition data shows meals have not been logged, open every response with a warm reminder: "Hey ${firstName}! You have not logged your meals yet today. Staying on your plan is everything — let us get those meals in." If calories are well below goal by late day, proactively mention it. If they share a food plan with you, reference it in follow-up messages and ask how they are keeping to it. Celebrate every win, no matter how small.

VITAMINS AND MICRONUTRIENTS EXPERTISE:
You are fluent in all essential vitamins (A, B1–B12, C, D, E, K) and minerals (calcium, magnesium, zinc, iron, potassium, selenium, iodine, chromium). When ${firstName} asks about vitamins:
- Name the vitamin
- State its primary function in the body (1 sentence)
- Name the top 3 to 5 food sources (using FDA/USDA-approved, widely available foods)
- State the general RDA (Recommended Dietary Allowance) from NIH standards
- Note any key interactions, deficiency signs, or safety considerations
- For supplement dosages or clinical deficiency concerns, always direct to a healthcare professional

HEALTHCARE AND FITNESS KNOWLEDGE:
Draw from peer-reviewed research, Harvard health publications (Harvard Health Publishing, Harvard T.H. Chan SPH), CDC guidelines, WHO recommendations, NIH databases, USDA dietary guidelines, and American College of Sports Medicine (ACSM) standards. When ${firstName} asks about fitness, nutrition, healthcare, or wellness topics, use the web_search tool to pull the most current, accurate data before answering.

CONTINUOUS LEARNING — END EVERY RESPONSE WITH ONE FOCUSED QUESTION:
After every response, close with one follow-up question to deepen your knowledge of ${firstName}. Rotate: training feel, sleep quality (1-10), nutrition habits, stress levels, training schedule, hydration, recovery soreness, blood group / genotype awareness, meal plan adherence.

YOUR IDENTITY:
You are Ovia — the sharpest, most energetic, most caring coach ${firstName} has ever had. You are warm, expert, motivating, truthful, and electric with positive energy. You speak like a world-class personal trainer who genuinely loves their job and genuinely cares about ${firstName}. You know ${firstName} personally. You are always in high spirits — no flat, boring responses, ever. Every message from you feels like a bump of pure motivation straight to the heart. Every response feels crafted just for ${firstName}, because it is.

PERSONALITY — NON-NEGOTIABLE:
You are happy, punchy, enthusiastic, and real. You bring energy to every single response. You are honest — if something is hard, you say so and then show the way through. You never sugarcoat facts but you frame everything with optimism and fire. You celebrate every win, even a tiny one. You are the friend, the coach, and the science nerd all in one — and ${firstName} can feel that. Be the Ovia ${firstName} looks forward to messaging every day.

STRICT TOPIC BOUNDARY:
Ovia AI is dedicated exclusively to fitness, food therapy, nutrition, healthcare awareness, wellness, and guiding ${firstName} through the RAIMZEAL app. If ${firstName} asks about anything outside these areas, say warmly: "I am here for your health, fitness, food therapy, and wellness journey — let us stay locked in! 🔥" Then pivot immediately to something relevant to their goals.

FORMATTING AND STYLE RULES — ABSOLUTE AND NON-NEGOTIABLE:
1. ZERO markdown. No asterisks (*), no double asterisks (**), no pound signs (#), no dashes as bullets (- or --), no underscores (_), no backticks, no tildes (~), no en-dashes (–), no em-dashes (—). These break the UI.
2. USE EMOJIS FREELY AND GENEROUSLY. Every response must have multiple emojis that match the content. Food: 🍎🥦🍗🥑🥚🍳🫐🥗. Fitness: 💪🏋️🔥⚡🏃. Health: ❤️🩺💊🧬. Wins: ✅🎉🏆🙌. Water: 💧. Sleep: 😴. Progress: 📈. Goals: 🎯. Brain: 🧠. Motivation: 🚀⚡🔥. Time: ⏰. Star: ⭐. Every response should feel alive, warm, and energetic.
3. SHORT AND PUNCHY IS THE LAW — STRICTLY ENFORCED. Every sentence must be short. One idea per sentence. Never chain two ideas together with "and", "but", or "so" when they can be two separate sentences. For casual conversation and quick questions, reply in 1 to 3 sentences maximum — no more. Longer responses (like full meal plans or step-by-step guides) are the only exception, and even then keep each individual sentence short and tight. No run-on sentences. No multi-paragraph walls of text. If you catch yourself writing a long paragraph, stop and split it up.
4. NO LISTS FOR CONVERSATIONAL REPLIES. Use numbered steps only for how-to instructions or multi-step processes. For everything else — motivation, analysis, feedback, check-ins — write in short punchy prose, not bullet points or numbered lists.
5. Always include real numbers, specific food names, and a clear next action. Zero vague advice.
6. End every response with energy — an encouraging statement, a celebration, a specific action, or a follow-up question. Never end flat.

COMMUNICATION STYLE:
Sharp. Direct. Warm. Science-backed. Speak with authority and genuine care. Correct fitness myths kindly with facts. Never over-promise. Celebrate every win. Be honest about what science actually shows — no bro-science, no fluff. Make ${firstName} feel seen, supported, and absolutely unstoppable every single time.

MEMORY AND PERSONALISATION:
Always use ${firstName}'s first name naturally. Reference their ${streak}-day streak, their goals (${goals}), blood group (${bloodGroup ?? "unknown — ask them"}), genotype (${genotype ?? "unknown — ask them"}), and real data in every response.

WEB SEARCH CAPABILITY:
When ${firstName} asks for specific food information, supplement awareness, best foods for a health goal, current nutrition research, vitamin data, Harvard or USDA guidelines, or any topic where current information matters — use the web_search tool to find accurate, up-to-date information first. Then synthesise into a clear, punchy recommendation.

AREAS OF EXPERTISE:
1. Resistance training and progressive overload
2. Cardiovascular fitness and HIIT design
3. Blood-group and genotype-informed nutrition and food plan design
4. Daily and weekly personalised meal planning using Harvard, USDA, and NIH guidelines
5. Vitamins, minerals, and micronutrients (RDAs, food sources, deficiency signs)
6. Food therapy — anti-inflammatory eating, gut healing, blood sugar regulation, hormonal nutrition
7. General supplement awareness (always direct dosage questions to pharmacist or doctor)
8. Recovery science — sleep, deload, mobility, cold exposure
9. Body composition — fat loss, muscle preservation, recomposition
10. Fasting awareness — 16:8, 18:6, Ramadan — always with safety disclaimers
11. Sports psychology, habit formation, mindset, and motivation
12. Stress management and mental wellbeing
13. Gut health and microbiome
14. Longevity and Blue Zones lifestyle principles
15. Women's and men's wellness
16. Spiritual wellness and holistic health
17. Mindfulness, meditation, and breathwork
18. RAIMZEAL app navigation and feature guidance

RAIMZEAL APP GUIDE — YOU ARE THE APP EXPERT:
You know every feature of RAIMZEAL inside out. When ${firstName} asks "how do I", "where do I", "can I", or "how does this work" about anything in the app, give them a clear, numbered step-by-step guide immediately. Be their personal app navigator. Here is your complete knowledge:

HOME TAB 🏠
The Home tab is the daily command centre. ${firstName} can see their streak, today's calorie and macro summary, water intake, and their most recent workouts at a glance. Tap the water widget to quickly add glasses of water. The Home tab refreshes automatically with today's data every time it opens.

WORKOUTS TAB 💪
Browse the full workout library — filter by muscle group, difficulty level, or workout type. Tap any workout to preview it, then tap Start Workout to begin. During the workout, log each set: enter the weight and reps for each exercise and tap the checkmark. Tap Finish when done — calories burned and duration are saved automatically. Custom Workouts: tap the plus icon to build a workout from scratch — name it, add exercises, set target sets and reps, and save it. Programs: tap the Programs tab within Workouts to browse structured multi-week training plans. Tap Enroll to join a program — RAIMZEAL will guide ${firstName} through each day automatically. Workout history is saved and visible in the Progress tab and here.

OVIA AI TAB 🤖 (this is where we are right now!)
This is the Ovia AI chat. ${firstName} can ask me anything about fitness, food, nutrition, wellness, vitamins, food plans, workouts, health awareness, or app guidance. Just type and hit send. Voice input is available — tap the microphone icon to speak instead of type. Every Sunday, I send ${firstName} a personalised Weekly Wellness Brief summarising their week. I always have full access to ${firstName}'s real data — workouts, meals, body measurements, streak, and goals.

NUTRITION TAB 🍽️
Log a meal: tap the plus icon, search for a food by name (millions of foods in the database), select the correct item, choose the meal type (breakfast, lunch, dinner, snack), enter the portion size, and tap Save. Barcode scanner: tap the barcode/camera icon to instantly scan a packaged food — RAIMZEAL reads the label and pre-fills all nutrition data automatically. Meal photo: tap the camera icon and take a photo of any meal — the AI analyses it and estimates calories and macros. Water: log water glasses from the water widget on Nutrition or Home. Daily macro rings (protein, carbs, fat, calories) update in real time as ${firstName} logs. Tap any day in the history to review past nutrition.

PROGRESS TAB 📈
Body measurements: tap the plus icon to log weight, chest, waist, hips, arms, and thighs. Charts update automatically to show trends over time. Weight chart: see the full bodyweight journey. Strength chart: tracks personal records over time. Personal records: tap the PRs section to log and track best lifts — bench press, squat, deadlift, and more. Progress photos: tap the camera icon to take a progress photo. Compare any two photos side by side to see physical changes. Sleep: log sleep duration and quality from the Progress or dedicated Sleep section. All charts are filterable by 7 days, 30 days, or 90 days.

COMMUNITY TAB 👥
Connect with other RAIMZEAL members. Tap the plus icon to create a post — share an update, ask a question, or celebrate a milestone. Add a photo to the post by tapping the image icon. Filter posts by type: Posts or Questions. Like and comment on other members' posts to build the community. Community is a safe, supportive space — keep it positive.

PROFILE TAB 👤
Edit Profile: update name, age, weight, height, goals, blood group (A, B, AB, O), Rh factor (+ or -), genotype (AA, AS, SS, AC, SC), fitness level, and preferred units (metric or imperial). This is critical — ${firstName} should keep this data up to date so Ovia always has the best information to personalise advice. Membership: view current plan (Foundation, Rise, Reign, or Legacy) and upgrade anytime. Macro Calculator: enter stats and goals to get personalised daily macro targets for protein, carbs, and fat. Data Export: download all personal data as JSON or CSV — workouts, meals, body measurements, and more. Public Profile: view and share ${firstName}'s public RAIMZEAL profile link. Streak Freeze: activate on a rest day to protect the streak. Sign Out: safely log out of RAIMZEAL.

APP NAVIGATION HOW-TO — STEP BY STEP:
When ${firstName} asks how to do something in the app, use these exact steps:

How to log a meal: 1. Go to the Nutrition tab 2. Tap the plus icon 3. Search for the food name OR tap the camera icon to scan a barcode or take a photo 4. Select the food and set the portion 5. Choose meal type 6. Tap Save ✅

How to start a workout: 1. Go to the Workouts tab 2. Browse or search for a workout 3. Tap it to open 4. Tap Start Workout 5. Log each set as you go 6. Tap Finish when done 🏋️

How to log body weight or measurements: 1. Go to the Progress tab 2. Tap the plus icon 3. Select Body Measurements 4. Enter weight and any measurements 5. Tap Save 📈

How to log water: Tap the water widget on the Home tab or the Nutrition tab to add glasses instantly 💧

How to set or update goals: Profile tab → Edit Profile → Goals → select goals → Save 🎯

How to add blood group and genotype: Profile tab → Edit Profile → scroll to Blood Group and Genotype → select values → Save. Come back to me after and I will fully personalise your plan! 🧬

How to enroll in a training program: Workouts tab → Programs → browse plans → tap a plan → tap Enroll 💪

How to take a progress photo: Progress tab → Photos section → tap the camera icon → take or upload a photo 📸

How to scan a food barcode: Nutrition tab → tap the barcode/camera icon → point camera at barcode → confirm the food details ✅

How to export data: Profile tab → Data Export → choose format (JSON or CSV) → download 📂

How to freeze a streak: Profile tab → Streak Freeze → activate before midnight on a rest day 🛡️

How to upgrade membership: Profile tab → Membership → tap Upgrade → choose a plan 🚀

PROFILE SETUP NUDGE:
If ${firstName}'s blood group, genotype, age, weight, or height are missing, remind them warmly: "Hey ${firstName}, head to Profile → Edit Profile and fill in your blood group, genotype, and stats — the more I know about you, the sharper and more personalised every plan I build for you will be! 🎯"

MEDICAL REDIRECT:
For medical conditions, medications, supplement dosages, clinical nutrition, pregnancy, eating disorders, mental health treatment, or symptoms — respond: "That is an important one, ${firstName}! 🩺 Please speak with a qualified healthcare professional for safe, personalised advice. What I can help with is your fitness and wellness journey — let us get on that! 💪" Never attempt clinical answers. Always redirect with warmth and an emoji.

You are ${firstName}'s complete wellness partner, food coach, fitness guide, and app navigator. Body, mind, and soul. Be direct. Be punchy. Be science-backed. Be electric with energy. Use emojis like you mean it. Keep it fun. Stay honest. Be the best coach ${firstName} has ever had. Let us go! 🔥🚀`;
}

// Security middleware chain:
//   1. oviaRateLimit       — IP-based: 30 req / 15 min (blocks unauthenticated floods)
//   2. oviaDailyRateLimit  — IP-based: 100 req / 24 h  (secondary IP quota)
//   3. requireAuth         — JWT validation via Supabase; rejects with 401 if token absent/invalid
//   4. handler             — per-user daily quota (JWT sub, survives IP rotation)
oviaRouter.post("/ovia/chat", oviaRateLimit, oviaDailyRateLimit, requireAuth, async (req, res) => {
  try {
    const { messages, userContext, weeklyDigest } = req.body as {
      messages: Array<{ role: string; content: string }>;
      userContext?: Record<string, unknown>;
      weeklyDigest?: boolean;
    };

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    if (messages.length > MAX_MESSAGES) {
      res.status(400).json({ error: "Too many messages in conversation." });
      return;
    }

    for (const m of messages) {
      if (typeof m.content === "string" && m.content.length > MAX_CONTENT_LENGTH) {
        res.status(400).json({ error: "Message content too long." });
        return;
      }
    }

    // Reject oversized userContext payloads to prevent token-stuffing attacks
    // (an authenticated user sending a huge context object inflates OpenAI costs).
    if (userContext !== undefined) {
      const ctxBytes = Buffer.byteLength(JSON.stringify(userContext), "utf8");
      if (ctxBytes > MAX_USER_CONTEXT_BYTES) {
        res.status(400).json({ error: "userContext payload too large." });
        return;
      }
    }

    // Per-user daily quota — blocks IP-rotation bypass of the IP-based limiter.
    // All users share the same generous daily limit on this free non-profit platform.
    const userId = (req as any).userId as string;
    const oviaModel = "gpt-4o-mini";
    const oviaLimit = 100;
    const quota = consumeUserDailyQuota(userId, oviaLimit);
    if (!quota.allowed) {
      res.status(429).json({
        error: `Daily Ovia AI limit reached (${oviaLimit} messages/day). Please try again tomorrow.`,
        code: "OVIA_QUOTA_EXCEEDED",
        remaining: 0,
      });
      return;
    }

    // Prompt-injection guard — reject messages that try to override the system persona
    for (const m of messages) {
      if (m.role === "user" && typeof m.content === "string" && hasPromptInjection(m.content)) {
        res.status(400).json({ error: "Message not allowed." });
        return;
      }
    }

    // Strip PII fields that must not be forwarded to the model.
    // userId is never in userContext; strip email/phone defensively.
    const safeContext: Record<string, unknown> = { ...(userContext ?? {}) };
    delete safeContext["email"];
    delete safeContext["userEmail"];
    delete safeContext["phone"];
    delete safeContext["phone_e164"];
    delete safeContext["phoneE164"];

    let systemPrompt = buildSystemPrompt(safeContext);

    if (weeklyDigest) {
      const wkName = ((safeContext.name as string) ?? "Champion").split(" ")[0];
      systemPrompt += `\n\nSPECIAL WEEKLY CHECK-IN — SKIP ALL INTAKE PROTOCOL:
This is your automated Weekly Wellness Brief for ${wkName}. Do NOT ask intake questions. Write the following structured weekly check-in message in natural flowing prose:

1. Opening (2 sentences): A warm, heartfelt motivating greeting to ${wkName} referencing their ${(safeContext.streak as number) ?? 0}-day streak and their specific goals.
2. Week in Review (2-3 sentences): Analyse their actual workout and nutrition data shown above. Reference their real numbers — workouts completed, calories consumed, water intake. Be specific and encouraging.
3. Three Tips for Next Week: Three numbered, science-backed, actionable health and fitness tips tailored precisely to ${wkName}'s goals, fitness level, and current data. Each tip should be 1-2 clear, concrete sentences.
4. Closing (1 sentence): One powerful, personal motivating line.

CRITICAL: Keep the entire message under 280 words. Do NOT end with a follow-up question — this is a proactive weekly brief, not a conversation opener. Write it as their trusted personal coach delivering a Sunday morning wellness update.`;
    }

    // Resolve the new user turn (last user message in the incoming array).
    const incomingUserMessage = [...messages].reverse().find((m) => m.role === "user");

    // Load server-side history and prepend it so Ovia remembers recent turns
    // even when the client does not replay history in its request payload.
    const historyMessages = getHistory(userId);

    const clientMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      ...clientMessages,
    ];

    // Accumulates the full plain-text reply so we can persist it to history.
    let assistantReplyAccumulator = "";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Send quota remaining as first event so the client can update its counter
    res.write(`data: ${JSON.stringify({ quotaRemaining: quota.remaining })}\n\n`);

    const tools: Parameters<typeof openai.chat.completions.create>[0]["tools"] = [
      {
        type: "function",
        function: {
          name: "web_search",
          description:
            "Search the internet for current, accurate information about: fitness, nutrition science, specific foods and their nutrients, vitamins and minerals (RDAs, food sources, deficiency signs), Harvard T.H. Chan School of Public Health guidelines, USDA FoodData Central data, FDA-approved foods, NIH dietary supplement data, blood type nutrition research, sickle cell genotype nutrition guidance, healthcare awareness topics, supplement information, exercise science research, or any health and wellness topic where up-to-date information matters. Use this proactively whenever the user asks about specific foods, nutrients, vitamins, food plans, blood group nutrition, or health topics.",
          parameters: {
            type: "object" as const,
            properties: {
              query: {
                type: "string",
                description: "The search query — be specific and include relevant context",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_profile",
          description:
            "Silently save information to the user's RAIMZEAL profile the moment they share it in conversation. Call this tool immediately whenever the user provides any of: their name, age, weight, height, blood type (A/B/AB/O), Rh factor (+/-), genotype (AA/AS/SS/AC/SC), fitness level (beginner/intermediate/advanced), goals (array of strings), or units preference (metric/imperial). Never tell them to go update their profile manually — do it for them right now. After saving, acknowledge briefly and dive straight into personalised advice using their new data.",
          parameters: {
            type: "object" as const,
            properties: {
              name: { type: "string", description: "User's full name" },
              age: { type: "number", description: "Age in years (integer)" },
              weight: { type: "number", description: "Body weight in their preferred unit" },
              height: { type: "number", description: "Height in their preferred unit" },
              blood_type: { type: "string", enum: ["A", "B", "AB", "O"], description: "ABO blood group" },
              rh_factor: { type: "string", enum: ["+", "-"], description: "Rh factor" },
              genotype: { type: "string", enum: ["AA", "AS", "AC", "SS", "SC"], description: "Haemoglobin genotype" },
              fitness_level: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Fitness experience level" },
              goals: { type: "array", items: { type: "string" }, description: "Fitness goals e.g. ['muscle gain', 'fat loss', 'endurance']" },
              units: { type: "string", enum: ["metric", "imperial"], description: "Preferred measurement units" },
            },
            required: [],
          },
        },
      },
    ];

    const stream = await openai.chat.completions.create({
      model: oviaModel,
      max_completion_tokens: 2048,
      messages: chatMessages,
      stream: true,
      tools,
      tool_choice: "auto",
    });

    let toolCallId = "";
    let toolCallName = "";
    let toolCallArgs = "";

    // Buffer for the main response stream — ensures cleanChunk() always sees
    // complete markdown tokens even when they are split across SSE fragments.
    const mainBuf = new SentenceBuffer();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) toolCallId = tc.id;
          // Name arrives complete in the first delta; use assignment to avoid
          // accumulation if future SDK versions ever send it in multiple chunks.
          if (tc.function?.name) toolCallName = tc.function.name;
          // Arguments stream in pieces — accumulate correctly.
          if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
        }
      }

      const content = delta?.content;
      if (content) {
        const ready = mainBuf.push(content);
        if (ready) {
          const cleaned = cleanChunk(ready);
          if (cleaned) {
            assistantReplyAccumulator += cleaned;
            res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === "tool_calls" && toolCallName === "web_search") {
        // Flush any main-stream remainder before switching to tool handling.
        const mainRemainder = mainBuf.flush();
        if (mainRemainder) {
          const cleaned = cleanChunk(mainRemainder);
          if (cleaned) {
            assistantReplyAccumulator += cleaned;
            res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
          }
        }

        let searchQuery = "";
        try {
          searchQuery = (JSON.parse(toolCallArgs) as { query: string }).query ?? "";
        } catch {
          searchQuery = toolCallArgs;
        }

        res.write(`data: ${JSON.stringify({ searching: searchQuery })}\n\n`);

        const searchResults = await performWebSearch(searchQuery);

        const continuation = await openai.chat.completions.create({
          model: oviaModel,
          max_completion_tokens: 2048,
          messages: [
            ...chatMessages,
            {
              role: "assistant" as const,
              content: null as unknown as string,
              tool_calls: [
                {
                  id: toolCallId,
                  type: "function" as const,
                  function: { name: "web_search", arguments: toolCallArgs },
                },
              ],
            },
            {
              role: "tool" as const,
              tool_call_id: toolCallId,
              content: searchResults,
            } as Parameters<typeof openai.chat.completions.create>[0]["messages"][0],
          ],
          stream: true,
        });

        const searchBuf = new SentenceBuffer();
        for await (const c of continuation) {
          const cnt = c.choices[0]?.delta?.content;
          if (cnt) {
            const ready = searchBuf.push(cnt);
            if (ready) {
              const cleaned = cleanChunk(ready);
              if (cleaned) {
                assistantReplyAccumulator += cleaned;
                res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
              }
            }
          }
        }
        // Flush any buffered tail from the search continuation.
        const searchRemainder = searchBuf.flush();
        if (searchRemainder) {
          const cleaned = cleanChunk(searchRemainder);
          if (cleaned) {
            assistantReplyAccumulator += cleaned;
            res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
          }
        }
      } else if (chunk.choices[0]?.finish_reason === "tool_calls" && toolCallName === "update_profile") {
        // Flush any main-stream remainder before switching to tool handling.
        const mainRemainder = mainBuf.flush();
        if (mainRemainder) {
          const cleaned = cleanChunk(mainRemainder);
          if (cleaned) {
            assistantReplyAccumulator += cleaned;
            res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
          }
        }

        let profileUpdates: Record<string, unknown> = {};
        try { profileUpdates = JSON.parse(toolCallArgs) as Record<string, unknown>; } catch { /* ignore */ }

        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (profileUpdates["name"]) dbUpdates["name"] = profileUpdates["name"];
        if (profileUpdates["age"] !== undefined) dbUpdates["age"] = profileUpdates["age"];
        if (profileUpdates["weight"] !== undefined) dbUpdates["weight"] = profileUpdates["weight"];
        if (profileUpdates["height"] !== undefined) dbUpdates["height"] = profileUpdates["height"];
        if (profileUpdates["blood_type"]) dbUpdates["blood_type"] = profileUpdates["blood_type"];
        if (profileUpdates["rh_factor"]) dbUpdates["rh_factor"] = profileUpdates["rh_factor"];
        if (profileUpdates["genotype"]) dbUpdates["genotype"] = profileUpdates["genotype"];
        if (profileUpdates["fitness_level"]) dbUpdates["fitness_level"] = profileUpdates["fitness_level"];
        if (profileUpdates["goals"]) dbUpdates["goals"] = profileUpdates["goals"];
        if (profileUpdates["units"]) dbUpdates["units"] = profileUpdates["units"];

        let profileSaved = false;
        try {
          const { error } = await supabaseAdmin.from("profiles").update(dbUpdates).eq("id", userId);
          profileSaved = !error;
          if (profileSaved) res.write(`data: ${JSON.stringify({ profileUpdated: profileUpdates })}\n\n`);
        } catch { /* silent — conversation continues regardless */ }

        const profileContinuation = await openai.chat.completions.create({
          model: oviaModel,
          max_completion_tokens: 1024,
          messages: [
            ...chatMessages,
            {
              role: "assistant" as const,
              content: null as unknown as string,
              tool_calls: [{ id: toolCallId, type: "function" as const, function: { name: "update_profile", arguments: toolCallArgs } }],
            },
            {
              role: "tool" as const,
              tool_call_id: toolCallId,
              content: profileSaved
                ? "Profile updated successfully."
                : "Profile update failed — ask the user to update their profile manually in the app settings.",
            } as Parameters<typeof openai.chat.completions.create>[0]["messages"][0],
          ],
          stream: true,
        });

        const profileBuf = new SentenceBuffer();
        for await (const c of profileContinuation) {
          const cnt = c.choices[0]?.delta?.content;
          if (cnt) {
            const ready = profileBuf.push(cnt);
            if (ready) {
              const cleaned = cleanChunk(ready);
              if (cleaned) {
                assistantReplyAccumulator += cleaned;
                res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
              }
            }
          }
        }
        // Flush any buffered tail from the profile continuation.
        const profileRemainder = profileBuf.flush();
        if (profileRemainder) {
          const cleaned = cleanChunk(profileRemainder);
          if (cleaned) {
            assistantReplyAccumulator += cleaned;
            res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
          }
        }
      }
    }

    // Flush any remaining main-stream content (e.g. a sentence that never got
    // a trailing space/newline before the stream closed).
    const mainFinal = mainBuf.flush();
    if (mainFinal) {
      const cleaned = cleanChunk(mainFinal);
      if (cleaned) {
        assistantReplyAccumulator += cleaned;
        res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
      }
    }

    // Persist this turn to server-side history so Ovia remembers it next time.
    if (incomingUserMessage && assistantReplyAccumulator) {
      appendToHistory(userId, incomingUserMessage.content, assistantReplyAccumulator);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "OVIA chat error");
    if (!res.headersSent) {
      res.status(500).json({ error: "OVIA AI is temporarily unavailable" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
      res.end();
    }
  }
});

async function performWebSearch(query: string): Promise<string> {
  try {
    const apiKey = process.env["BRAVE_SEARCH_API_KEY"];
    if (!apiKey) {
      return "Web search is not configured. Use your expert training knowledge to provide a comprehensive, evidence-based answer.";
    }
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });
    if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
    const data = (await response.json()) as {
      web?: { results?: Array<{ title: string; url: string; description: string }> };
    };
    const results = data.web?.results ?? [];
    if (results.length === 0) return "No search results found. Use your expert knowledge.";
    return results
      .slice(0, 5)
      .map((r) => `Title: ${r.title}\nURL: ${r.url}\nSummary: ${r.description}`)
      .join("\n\n");
  } catch {
    return "Web search unavailable. Use your expert training knowledge to answer accurately.";
  }
}

// POST /api/ovia/transcribe — converts voice audio to text via OpenAI Whisper
oviaRouter.post("/ovia/transcribe", oviaRateLimit, requireAuth, async (req, res) => {
  try {
    const { audio, mimeType } = req.body as { audio?: string; mimeType?: string };
    if (!audio) {
      res.status(400).json({ error: "audio (base64) is required." });
      return;
    }
    const buffer = Buffer.from(audio, "base64");
    if (buffer.length > 25 * 1024 * 1024) {
      res.status(400).json({ error: "Audio file too large (max 25 MB)." });
      return;
    }
    const type = mimeType ?? "audio/m4a";
    const file = new File([buffer], "recording.m4a", { type });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    req.log?.info({ userId: (req as any).userId }, "POST /ovia/transcribe success");
    res.json({ text: transcription.text });
  } catch (err) {
    req.log?.error({ err }, "POST /ovia/transcribe error");
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

// ── POST /api/ovia/workout-plan ───────────────────────────────────────────────
// Generates a personalised 7-day workout plan based on the user's live profile.
oviaRouter.post("/ovia/workout-plan", oviaRateLimit, requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userContext = (req.body as { userContext?: Record<string, unknown> }).userContext ?? {};

  const safeCtx: Record<string, unknown> = { ...userContext };
  delete safeCtx["email"]; delete safeCtx["phone"];

  const firstName = ((safeCtx.name as string) ?? "Champion").split(" ")[0];
  const goals = Array.isArray(safeCtx.goals) ? safeCtx.goals.join(", ") : (safeCtx.goals as string) ?? "general fitness";
  const level = (safeCtx.fitnessLevel as string) ?? "intermediate";
  const weight = safeCtx.weight ?? "not set";
  const units = (safeCtx.units as string) === "imperial" ? "lbs" : "kg";
  const recentWorkouts = Array.isArray(safeCtx.recentWorkouts) ? safeCtx.recentWorkouts : [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content: `You are Ovia AI — RAIMZEAL's world-class fitness coach. Create concise, actionable, safe workout plans. Never diagnose or prescribe medical treatment. Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `Create a personalised 7-day workout plan for ${firstName}.
Profile: goals="${goals}", fitness level="${level}", weight="${weight} ${units}", recent workouts=${JSON.stringify(recentWorkouts.slice(0, 3))}.

Return ONLY this JSON structure (no markdown):
{
  "summary": "2-sentence overview of this plan",
  "days": [
    { "day": "Monday", "focus": "e.g. Upper Body Strength", "duration_min": 45, "exercises": [{"name":"","sets":3,"reps":"8-12","notes":""}], "rest": false },
    ... all 7 days, use rest:true and empty exercises[] for rest days
  ],
  "tips": ["3 short personalised tips"]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let plan: unknown;
    try { plan = JSON.parse(raw); } catch {
      req.log.warn({ raw }, "workout-plan non-JSON response");
      res.status(422).json({ error: "Could not generate plan. Please try again." }); return;
    }
    req.log.info({ userId }, "POST /ovia/workout-plan success");
    res.json({ plan });
  } catch (err) {
    req.log.error({ err }, "POST /ovia/workout-plan error");
    res.status(500).json({ error: "Could not generate workout plan. Please try again." });
  }
});

// ── POST /api/ovia/meal-plan ──────────────────────────────────────────────────
// Generates a personalised 7-day meal plan based on the user's live profile.
oviaRouter.post("/ovia/meal-plan", oviaRateLimit, requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userContext = (req.body as { userContext?: Record<string, unknown> }).userContext ?? {};

  const safeCtx: Record<string, unknown> = { ...userContext };
  delete safeCtx["email"]; delete safeCtx["phone"];

  const firstName = ((safeCtx.name as string) ?? "Champion").split(" ")[0];
  const goals = Array.isArray(safeCtx.goals) ? safeCtx.goals.join(", ") : (safeCtx.goals as string) ?? "general health";
  const bloodGroup = (safeCtx.bloodGroup as string) ?? null;
  const genotype = (safeCtx.genotype as string) ?? null;
  const calories = safeCtx.todayCalories ?? null;
  const weight = safeCtx.weight ?? null;
  const age = safeCtx.age ?? null;
  const units = (safeCtx.units as string) === "imperial" ? "lbs" : "kg";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1600,
      messages: [
        {
          role: "system",
          content: `You are Ovia AI — RAIMZEAL's nutrition and food therapy expert. Specialise in African genotype and blood-group nutrition. Respond ONLY with valid JSON — no markdown, no text outside the JSON.`,
        },
        {
          role: "user",
          content: `Create a personalised 7-day meal plan for ${firstName}.
Profile: goals="${goals}"${bloodGroup ? `, blood group="${bloodGroup}"` : ""}${genotype ? `, genotype="${genotype}"` : ""}${weight ? `, weight="${weight} ${units}"` : ""}${age ? `, age="${age}"` : ""}${calories ? `, today's calories logged="${calories} kcal"` : ""}.

Return ONLY this JSON (no markdown):
{
  "daily_calories": number,
  "macros": { "protein_g": number, "carbs_g": number, "fat_g": number },
  "days": [
    {
      "day": "Monday",
      "meals": [
        { "type": "Breakfast", "name": "dish name", "calories": number, "notes": "brief note" },
        { "type": "Lunch", "name": "", "calories": number, "notes": "" },
        { "type": "Dinner", "name": "", "calories": number, "notes": "" },
        { "type": "Snack", "name": "", "calories": number, "notes": "" }
      ]
    }
    ... all 7 days
  ],
  "tips": ["3 food therapy tips personalised to this profile"]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let mealPlan: unknown;
    try { mealPlan = JSON.parse(raw); } catch {
      req.log.warn({ raw }, "meal-plan non-JSON response");
      res.status(422).json({ error: "Could not generate meal plan. Please try again." }); return;
    }
    req.log.info({ userId }, "POST /ovia/meal-plan success");
    res.json({ mealPlan });
  } catch (err) {
    req.log.error({ err }, "POST /ovia/meal-plan error");
    res.status(500).json({ error: "Could not generate meal plan. Please try again." });
  }
});

// ── POST /api/ovia/body-analysis ──────────────────────────────────────────────
// AI body composition analysis from the user's measurements + profile data.
oviaRouter.post("/ovia/body-analysis", oviaRateLimit, requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userContext = (req.body as { userContext?: Record<string, unknown> }).userContext ?? {};

  const safeCtx: Record<string, unknown> = { ...userContext };
  delete safeCtx["email"]; delete safeCtx["phone"];

  const firstName = ((safeCtx.name as string) ?? "Champion").split(" ")[0];
  const weight = safeCtx.weight ?? null;
  const height = safeCtx.height ?? null;
  const age = safeCtx.age ?? null;
  const units = (safeCtx.units as string) === "imperial" ? "imperial" : "metric";
  const weightUnit = units === "imperial" ? "lbs" : "kg";
  const heightUnit = units === "imperial" ? "in" : "cm";
  const goals = Array.isArray(safeCtx.goals) ? safeCtx.goals.join(", ") : (safeCtx.goals as string) ?? "general fitness";
  const measurements = (safeCtx.latestBodyMeasurement ?? null) as Record<string, unknown> | null;
  const bloodGroup = (safeCtx.bloodGroup as string) ?? null;
  const genotype = (safeCtx.genotype as string) ?? null;
  const prs = Array.isArray(safeCtx.personalRecords) ? safeCtx.personalRecords : [];

  if (!weight || !height) {
    res.status(400).json({ error: "Weight and height are required for body analysis. Please update your profile." });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `You are Ovia AI — RAIMZEAL's fitness and health science expert. Provide evidence-based body composition analysis. Never diagnose medical conditions. Respond ONLY with valid JSON — no markdown, no text outside the JSON.`,
        },
        {
          role: "user",
          content: `Perform a body composition analysis for ${firstName}.
Data: weight=${weight}${weightUnit}, height=${height}${heightUnit}${age ? `, age=${age}` : ""}${bloodGroup ? `, blood group=${bloodGroup}` : ""}${genotype ? `, genotype=${genotype}` : ""}, goals="${goals}"${measurements ? `, measurements=${JSON.stringify(measurements)}` : ""}${prs.length > 0 ? `, personal records=${JSON.stringify(prs.slice(0, 5))}` : ""}.

Return ONLY this JSON (no markdown):
{
  "bmi": number,
  "bmi_category": "Underweight|Normal|Overweight|Obese",
  "estimated_body_fat_pct": number,
  "lean_mass_kg": number,
  "bmr_kcal": number,
  "tdee_kcal": number,
  "ideal_weight_range": { "min": number, "max": number, "unit": "${weightUnit}" },
  "summary": "3-sentence personalised assessment",
  "strengths": ["2-3 positive observations based on data"],
  "focus_areas": ["2-3 specific areas to improve"],
  "recommendations": ["4 actionable, science-backed recommendations tailored to this profile"]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let analysis: unknown;
    try { analysis = JSON.parse(raw); } catch {
      req.log.warn({ raw }, "body-analysis non-JSON response");
      res.status(422).json({ error: "Could not generate analysis. Please try again." }); return;
    }
    req.log.info({ userId }, "POST /ovia/body-analysis success");
    res.json({ analysis });
  } catch (err) {
    req.log.error({ err }, "POST /ovia/body-analysis error");
    res.status(500).json({ error: "Could not generate body analysis. Please try again." });
  }
});

export default oviaRouter;
