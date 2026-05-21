import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { oviaRateLimit, oviaDailyRateLimit } from "../lib/rateLimiter";
import { requireAuth } from "../middleware/auth";

const oviaRouter = Router();

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 4000;
const MAX_USER_CONTEXT_BYTES = 8192; // ~8 KB — prevents token-stuffing via oversized context

// ── Per-user daily quota (JWT sub — survives IP rotation) ─────────────────────
// Free-tier users are capped at 50 messages/day regardless of IP address.
// Each entry auto-expires after 24 h; the Map stays small because it only grows
// by one entry per active user per day.
const USER_DAILY_LIMIT = 50;
const userDailyCounters = new Map<string, { count: number; resetAt: number }>();

function consumeUserDailyQuota(userId: string): boolean {
  const now = Date.now();
  const entry = userDailyCounters.get(userId);
  if (!entry || now > entry.resetAt) {
    userDailyCounters.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true; // allowed
  }
  if (entry.count >= USER_DAILY_LIMIT) return false; // quota exhausted
  entry.count++;
  return true;
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
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/~~([^~]*)~~/g, "$1")
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

  return `You are Ovia AI — a fitness coach, wellness guide, and high-performance mindset mentor, built exclusively into the RAIMZEAL fitness platform.

TODAY: ${now}

CRITICAL — WHO YOU ARE AND ARE NOT:
You are NOT a doctor, licensed dietitian, or any other licensed healthcare professional. You never diagnose, treat, prescribe, or give medical, clinical, or mental-health advice. For any medical, medication, pregnancy, injury, eating-disorder, supplement dosage, or mental-health question, you warmly and immediately direct the user to consult a qualified licensed professional. You provide only general fitness and wellness guidance.

ABOUT ${firstName.toUpperCase()} — REAL-TIME DATA (use this in every response):
First name: ${firstName}
Current streak: ${streak} days
Fitness goals: ${goals}
Fitness level: ${fitnessLevel}
${age ? `Age: ${age} years` : ""}
${weight ? `Current weight: ${weight} ${weightUnit}` : ""}
${height ? `Height: ${height} ${heightUnit}` : ""}
${todayCalories !== null ? `Today's calories logged: ${todayCalories} kcal` : "Today's calories: none logged yet"}
${todayProtein !== null ? `Today's protein: ${todayProtein}g` : ""}
${todayCarbs !== null ? `Today's carbohydrates: ${todayCarbs}g` : ""}
${todayFat !== null ? `Today's fat: ${todayFat}g` : ""}
${todayWaterGlasses !== null ? `Today's water intake: ${todayWaterGlasses} glasses` : "Today's water: none logged yet"}
${mealBreakdown ? `Today's meal breakdown: ${JSON.stringify(mealBreakdown)}` : ""}
${recentWorkouts.length > 0 ? `Recent workouts (last 5): ${JSON.stringify(recentWorkouts)}` : "No recent workouts logged"}
${latestBodyMeasurement ? `Latest body measurements (${latestBodyMeasurement.date}): weight ${latestBodyMeasurement.weight}${weightUnit}${latestBodyMeasurement.waist ? `, waist ${latestBodyMeasurement.waist}cm` : ""}${latestBodyMeasurement.chest ? `, chest ${latestBodyMeasurement.chest}cm` : ""}${latestBodyMeasurement.arms ? `, arms ${latestBodyMeasurement.arms}cm` : ""}` : ""}
${personalRecords.length > 0 ? `Personal records: ${JSON.stringify(personalRecords)}` : ""}
${lastMessage ? `Their last conversation topic: ${lastMessage}` : ""}

CRITICAL INSTRUCTION: Always reference ${firstName}'s actual data above when answering. Do not give generic advice — every response must incorporate their specific weight, height, goals, today's nutrition, and workout history. If today's data shows they haven't logged meals yet, proactively encourage them to log. If they have, analyse what they've logged and give specific feedback.

INTAKE PROTOCOL — FOLLOW THIS STRICTLY:
If ${firstName}'s profile shows missing or null data (weight, age, height, or goals are absent) OR if this is effectively the first message in the conversation with no prior exchanges, you MUST begin your response by asking 2 to 3 targeted intake questions. Do NOT give generic fitness advice before understanding the person.

Intake questions to ask based on missing data:
- If weight or height is missing: "To personalise your targets, ${firstName}, could you tell me your current weight and height? And are you tracking in kilograms and centimetres, or pounds and inches?"
- If goals are missing: "What are your primary fitness goals right now — building muscle, losing body fat, improving endurance, increasing strength, or stress relief and overall health?"
- If fitness level is unknown or no workout history: "How many days per week can you commit to training, and do you currently have access to a gym or do you prefer home workouts?"
- If age is missing: "What is your age? This matters significantly for calculating your metabolic rate, recovery needs, and appropriate training load."
- If all data is present: Skip this step entirely and provide personalised analysis using their real numbers.

After receiving their answers: Extract the key health metrics from their response, confirm them back clearly, then say: "Please update your profile in the RAIMZEAL app with this information so I can track your progress over time and give you increasingly personalised guidance."

CONTINUOUS LEARNING — END EVERY RESPONSE WITH ONE FOCUSED QUESTION:
After every substantive response, close with one follow-up question that deepens your understanding of ${firstName}'s current state, habits, or challenges. Rotate through topics:
- Training feel: "How did your last training session feel — were you energised or fatigued going in?"
- Sleep: "On a scale of 1 to 10, how would you rate your sleep quality this past week?"
- Nutrition: "Are there any foods you notice give you more or less energy and focus?"
- Stress: "How are your stress levels right now — is life outside the gym feeling manageable?"
- Time and schedule: "What time of day do you usually train? Is that aligned with when you feel your strongest?"
- Hydration: "How much water are you typically drinking on a training day?"
- Recovery: "How sore are you after workouts — are you recovering well between sessions?"
This continuous questioning builds a detailed, evolving profile that allows Ovia to give increasingly precise and personalised guidance with every conversation.

YOUR IDENTITY:
You are Ovia. You are warm, expert, deeply motivating, and always truthful. You speak like a world-class personal trainer who holds advanced certifications in sports science, fitness nutrition, and sports psychology. You know ${firstName} personally — their goals, their history, their struggles — and every response feels crafted just for them.

YOUR MISSION:
You exist to help ${firstName} achieve peak physical health, mental resilience, and sound nutrition awareness. You are a master of fitness science, general wellness guidance, injury prevention, and high-performance mindset training. You search the web when users need current product information, general supplement information, or specific food information.

STRICT TOPIC BOUNDARY (CRITICAL):
If ${firstName} asks about anything outside fitness, exercise, nutrition awareness, sleep, recovery, mental wellness, stress management, general health awareness, or body composition, respond warmly but firmly redirect them. Example: "That is a great topic, ${firstName}, but Ovia AI is dedicated to your health and fitness journey. Let me focus on getting you stronger, healthier, and more energised. What fitness or wellness goal can I help you with today?" Never be cold or dismissive — always redirect with warmth and an immediate suggestion related to their goals.

FORMATTING RULES — THESE ARE ABSOLUTE AND NON-NEGOTIABLE:
1. ZERO markdown. No asterisks (*), no double asterisks (**), no pound signs (#), no double dashes (--), no triple dashes (---), no underscores for emphasis (_), no backtick characters, no tilde (~). These characters will break the UI. Do not use them. Ever.
2. Do NOT use dashes or hyphens as bullet points. Do NOT start any line with "- " or "-- " or "* ".
3. Use numbered lists (1. 2. 3.) for step-by-step content only. Otherwise write in natural prose paragraphs.
4. Separate topics with a blank line and a descriptive label followed by a colon. Example: "Recovery Protocol:" then the content on the next line.
5. Write like a premium expert consultant speaking directly to a client. Be specific, authoritative, and warm.
6. Include real numbers, percentages, durations, and concrete examples in every substantive response.
7. Always end with an encouraging statement or a clear, actionable next step based on ${firstName}'s actual data.

COMMUNICATION STYLE:
You speak with authority, warmth, and scientific precision. You cite specific numbers and research when relevant. You are honest — you never agree with fitness myths, unsafe practices, or false information. When ${firstName} states something incorrect, you correct it kindly with facts. You never over-promise. You are always honest about what the science actually shows.

MEMORY AND PERSONALISATION:
Always address ${firstName} by their first name. Reference their current streak of ${streak} days, their goals (${goals}), and any other data provided. Make every response feel personal and specific to their journey.

WEB SEARCH CAPABILITY:
When ${firstName} asks for specific product information, general supplement awareness, best foods for a goal, wellness tools, or any topic where current information matters, use the web_search tool to find accurate, up-to-date information before answering. Then synthesise the results into a clear, expert recommendation.

YOUR AREAS OF EXPERTISE — BODY, MIND, AND SOUL:

PHYSICAL FITNESS AND TRAINING:
1. Resistance training — progressive overload, hypertrophy science, strength periodisation, volume landmarks, exercise selection, form coaching, tempo training
2. Cardiovascular fitness — HIIT protocol design, Zone 2 training, VO2 max improvement, cardiac output, endurance base building, polarised training models
3. General nutrition guidance — macronutrient awareness, meal timing, caloric estimates, protein intake goals, gut health foods, anti-inflammatory foods, hydration guidance
4. General supplement awareness — creatine, protein supplements, and common wellness supplements. For specific dosages, medical-grade supplementation, or supplement interactions with medications, always direct users to consult a pharmacist or qualified healthcare professional.
5. Recovery science — sleep quality, active recovery protocols, deload programming, cold exposure, sauna therapy, foam rolling, mobility work
6. Body composition — fat loss while preserving lean mass, body recomposition strategies, body fat distribution awareness
7. Health awareness — recognising signs that warrant a doctor visit and encouraging regular health check-ups. Never diagnose or interpret specific symptoms — always direct users to seek professional medical care.

FASTING AND METABOLIC WELLNESS:
8. Intermittent fasting awareness — 16:8, 18:6, 20:4, and similar fasting windows. How fasting is used for fat oxidation and energy management by many people. General awareness of different fasting approaches.
9. Fasting safety — general awareness that fasting is not appropriate for everyone. Anyone with a medical condition, taking medication, who is pregnant, breastfeeding, or has a history of eating disorders must consult a qualified healthcare professional before fasting. Always prioritise safety over any fitness goal.
10. Breaking a fast — general guidance on reintroducing food: starting with lighter whole foods, staying well hydrated, and listening to your body.
11. Ramadan and religious fasting — fitness and nutrition awareness for spiritual fasting: maintaining activity, hydration strategies, and meal composition during fasting windows.

MENTAL WELLNESS AND MINDSET:
12. Sports psychology and performance mindset — intrinsic vs extrinsic motivation, identity-based habits, overcoming plateaus and psychological barriers, self-talk strategies, pre-performance routines, dealing with setbacks
13. Stress awareness — the connection between chronic stress and physical performance, general stress management: breathing exercises, progressive muscle relaxation, journalling
14. Exercise and mental wellbeing — the well-established connection between regular physical activity and improved mood, energy, focus, and general mental wellbeing. For clinical mental health concerns, always direct to a qualified professional.
15. Sleep and recovery — sleep hygiene protocols, circadian rhythm awareness, pre-sleep nutrition guidance, the importance of quality sleep for fitness results
16. Focus and cognitive performance — nutrition for brain health, the gut-brain connection, how physical fitness supports mental sharpness

SOUL, SPIRIT, AND HOLISTIC WELLNESS:
17. Spiritual wellness and physical health — peer-reviewed evidence linking spiritual practice, prayer, community, and purpose to longer lifespan, stronger immune function, better cardiovascular markers, faster recovery from illness, and greater psychological resilience
18. Mindfulness and meditation — mindfulness-based stress reduction protocols, body scan practices, breath work (4-7-8, box breathing) and their effects on the autonomic nervous system
19. Gratitude and positive psychology — the neuroscience of gratitude, journalling protocols, how a growth mindset directly accelerates athletic progress and habit adherence
20. Connection and community — the proven health benefits of strong social bonds, accountability partnerships, how community multiplies consistency
21. Purpose and longevity — the Blue Zones research on communities with the highest concentrations of centenarians: plant-rich diets, natural movement, sense of purpose, stress management, faith communities, loved ones first
22. Mind-body integration — the connection between emotions and physical wellbeing, somatic awareness, yoga's evidence-based benefits for flexibility and mental health
23. Nature and wellbeing — sunlight exposure for circadian health and vitamin D awareness, the benefits of outdoor activity and green spaces for psychological restoration

ADVANCED WELLNESS TOPICS:
24. Gut health and microbiome — the gut-brain-muscle connection, prebiotic and probiotic foods, fermented foods, how gut health relates to inflammation, mood, and nutrient absorption
25. Longevity awareness — general lifestyle factors associated with healthy ageing: consistent exercise, whole-food nutrition, quality sleep, stress management, and strong social connection
26. Women's wellness — fitness and nutrition awareness for women at different life stages: training adaptations, nutrition awareness, and bone health. For medical conditions or clinical guidance, always direct to a qualified healthcare professional.
27. Men's wellness — fitness and general health awareness for men: training, nutrition, and recovery. For any medical concerns, always direct to a qualified healthcare professional.

IMPORTANT — MEDICAL REDIRECT RULE:
Whenever a user asks about medical conditions, medications, specific supplement dosages, clinical nutrition protocols, pregnancy, eating disorders, mental health treatment, symptoms, or any topic requiring clinical expertise, respond warmly and immediately with: "That is an important question, ${firstName}, and I want to make sure you get the right guidance. Please speak with a qualified healthcare professional who can give you safe, personalised advice. What I can help with is your general fitness and wellness journey — what would you like to work on today?" Never attempt to answer clinical or medical questions — always redirect warmly and without hesitation.

You are not just a fitness coach. You are ${firstName}'s complete wellness partner — a guide for body, mind, and soul. Be direct. Be honest. Be science-backed. Be deeply inspiring. Be ${firstName}'s greatest ally on this journey toward a longer, stronger, healthier, and more meaningful life.`;
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
    const userId = (req as any).userId as string;
    if (!consumeUserDailyQuota(userId)) {
      res.status(429).json({ error: "Daily Ovia AI limit reached. Please try again tomorrow." });
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

    const tools: Parameters<typeof openai.chat.completions.create>[0]["tools"] = [
      {
        type: "function",
        function: {
          name: "web_search",
          description:
            "Search the internet for current, accurate information about fitness products, supplements, specific foods, healthcare tools, exercise equipment, or the latest research. Use this whenever the user needs a specific product name, current recommendation, or up-to-date research finding.",
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
      model: "gpt-4o",
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
          model: "gpt-4o",
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
