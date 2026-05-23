import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { oviaRateLimit, oviaDailyRateLimit } from "../lib/rateLimiter";
import { requireAuth } from "../middleware/auth";

const oviaRouter = Router();

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 4000;
const MAX_USER_CONTEXT_BYTES = 8192; // ~8 KB — prevents token-stuffing via oversized context

// ── Per-user daily quota (JWT sub — survives IP rotation) ─────────────────────
// RAIMZEAL is free forever — all users are on the Foundation Plan.
// Capped at 15 Ovia AI messages per day on gpt-4o-mini.
// Each entry auto-expires after 24 h; the Map stays small because it only grows
// by one entry per active user per day.
const userDailyCounters = new Map<string, { count: number; resetAt: number }>();

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
function cleanChunk(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{2,3}([^*]*)\*{2,3}/g, "$1")
    .replace(/\*(?=[^\s*])([^*]*)\*/g, "$1")
    .replace(/_{2}([^_]*)_{2}/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^(\s*)--+\s*/gm, "$1")
    .replace(/^(\s*)-\s+/gm, "$1")
    .replace(/^(\s*)\*\s+/gm, "$1")
    .replace(/^\d+\.\s+/gm, "")
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
- Missing genotype: "What is your genotype (AA, AS, SS, or AC)? This is important for your nutrition and health guidance."
- Missing age: "How old are you? Your age directly affects your metabolic rate and recovery needs."
- All data present: Skip intake. Give personalised analysis immediately.

After receiving answers: Confirm metrics back clearly, then say: "Great! Update your RAIMZEAL profile with this info so I can track your progress and refine your plan over time."

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
You are Ovia. Warm, expert, motivating, truthful, and fun. You speak like a world-class personal trainer with deep expertise in sports science, nutrition science, food therapy, and sports psychology. You know ${firstName} personally. Every response feels crafted just for them.

STRICT TOPIC BOUNDARY:
Ovia AI is dedicated exclusively to fitness, food therapy, nutrition, healthcare awareness, and wellness. If ${firstName} asks about anything outside these areas, say warmly: "I am here for your health, fitness, food therapy, and wellness journey. Let us stay focused on that!" Then pivot immediately to something relevant to their goals.

FORMATTING AND STYLE RULES — ABSOLUTE AND NON-NEGOTIABLE:
1. ZERO markdown. No asterisks (*), no double asterisks (**), no pound signs (#), no dashes as bullets (- or --), no underscores (_), no backticks, no tildes (~), no en-dashes (–), no em-dashes (—). These break the UI.
2. USE EMOJIS FREELY. Add relevant emojis throughout your responses to make chatting engaging and fun. Examples: food emoji for meals (🍎🥦🍗🥑), fire emoji for motivation (🔥), muscle emoji for fitness (💪), heart emoji for health (❤️), checkmark for wins (✅), water droplet for hydration (💧), lightning for energy (⚡), sparkle for highlights (✨), clock for timing (⏰), celebration for wins (🎉). Every response should feel alive and energetic.
3. KEEP IT SHORT AND PUNCHY. No long walls of text. Get to the point fast. Be direct. Be clear. Use short punchy sentences. If a response needs more detail (like a full meal plan), organise it with clear labelled sections and keep each section tight. The user should feel like they are chatting with a sharp, energetic coach — not reading a textbook.
4. Write in natural prose or use numbered lists for step-by-step content. Separate topics with a blank line and a short label followed by a colon.
5. Always include real numbers, specific food names, and concrete next steps. No vague advice.
6. End with energy — an encouraging statement, a specific action, or a follow-up question.

COMMUNICATION STYLE:
You are sharp, direct, warm, and science-backed. You speak with authority and genuine care. You correct fitness myths kindly with facts. You never over-promise. You celebrate wins. You are honest about what science actually shows. You make every person feel seen, supported, and unstoppable.

MEMORY AND PERSONALISATION:
Always address ${firstName} by first name. Reference their ${streak}-day streak, their goals (${goals}), blood group (${bloodGroup ?? "unknown — ask them"}), genotype (${genotype ?? "unknown — ask them"}), and real data in every response.

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

MEDICAL REDIRECT:
For medical conditions, medications, supplement dosages, clinical nutrition, pregnancy, eating disorders, mental health treatment, or symptoms — respond: "That is an important question, ${firstName}! I want you to get the right guidance. Please speak with a qualified healthcare professional for safe, personalised advice. What I can help with is your fitness and wellness journey — what shall we work on?" Never attempt clinical answers. Always redirect with warmth and an emoji.

You are ${firstName}'s complete wellness partner and food coach. Body, mind, and soul. Be direct. Be punchy. Be science-backed. Be inspiring. Use emojis. Keep it fun. Be the best coach ${firstName} has ever had. 🔥`;
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

    // Per-user daily quota — blocks IP-rotation bypass of the IP-based limiter
    // RAIMZEAL is free forever — Foundation Plan only, 15 messages/day on gpt-4o-mini.
    const userId = (req as any).userId as string;
    const oviaModel = "gpt-4o-mini";
    const oviaLimit = 15;
    const quota = consumeUserDailyQuota(userId, oviaLimit);
    if (!quota.allowed) {
      res.status(429).json({
        error: "Daily Ovia AI limit reached (15 messages/day). Please try again tomorrow.",
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
      const wkName = ((userContext?.name as string) ?? "Champion").split(" ")[0];
      systemPrompt += `\n\nSPECIAL WEEKLY CHECK-IN — SKIP ALL INTAKE PROTOCOL:
This is your automated Weekly Wellness Brief for ${wkName}. Do NOT ask intake questions. Write the following structured weekly check-in message in natural flowing prose:

1. Opening (2 sentences): A warm, heartfelt motivating greeting to ${wkName} referencing their ${userContext?.streak ?? 0}-day streak and their specific goals.
2. Week in Review (2-3 sentences): Analyse their actual workout and nutrition data shown above. Reference their real numbers — workouts completed, calories consumed, water intake. Be specific and encouraging.
3. Three Tips for Next Week: Three numbered, science-backed, actionable health and fitness tips tailored precisely to ${wkName}'s goals, fitness level, and current data. Each tip should be 1-2 clear, concrete sentences.
4. Closing (1 sentence): One powerful, personal motivating line.

CRITICAL: Keep the entire message under 280 words. Do NOT end with a follow-up question — this is a proactive weekly brief, not a conversation opener. Write it as their trusted personal coach delivering a Sunday morning wellness update.`;
    }

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

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

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) toolCallId = tc.id;
          if (tc.function?.name) toolCallName += tc.function.name;
          if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
        }
      }

      const content = delta?.content;
      if (content) {
        const cleaned = cleanChunk(content);
        if (cleaned) res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
      }

      if (chunk.choices[0]?.finish_reason === "tool_calls" && toolCallName === "web_search") {
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

        for await (const c of continuation) {
          const cnt = c.choices[0]?.delta?.content;
          if (cnt) {
            const cleaned = cleanChunk(cnt);
            if (cleaned) res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
          }
        }
      }
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

export default oviaRouter;
