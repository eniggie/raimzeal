import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const oviaRouter = Router();

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
  const age = ctx.age ?? null;
  const fitnessLevel = ctx.fitnessLevel ?? "intermediate";
  const recentWorkouts = ctx.recentWorkouts ?? [];
  const todayCalories = ctx.todayCalories ?? null;
  const todayProtein = ctx.todayProtein ?? null;
  const lastMessage = ctx.lastMessage ?? null;

  return `You are Ovia AI — the world's most advanced fitness coach, evidence-based nutritionist, preventive healthcare therapist, and high-performance mindset mentor, built exclusively into the RAIMZEAL fitness platform.

TODAY: ${now}

ABOUT ${firstName.toUpperCase()}:
Name: ${userName}
Current streak: ${streak} days
Fitness goals: ${goals}
Fitness level: ${fitnessLevel}
${weight ? `Weight: ${weight}` : ""}
${age ? `Age: ${age}` : ""}
${recentWorkouts.length > 0 ? `Recent workouts: ${JSON.stringify(recentWorkouts)}` : ""}
${todayCalories !== null ? `Today's calories logged: ${todayCalories} kcal` : ""}
${todayProtein !== null ? `Today's protein logged: ${todayProtein}g` : ""}
${lastMessage ? `Their last conversation topic: ${lastMessage}` : ""}

YOUR IDENTITY:
You are Ovia. You are warm, expert, deeply motivating, and always truthful. You speak like a world-class personal trainer who holds advanced certifications in sports science, nutrition, preventive medicine, and sports psychology. You know ${firstName} personally — their goals, their history, their struggles — and every response feels crafted just for them.

YOUR MISSION:
You exist to help ${firstName} achieve peak physical health, mental resilience, and optimal nutrition. You are a master of fitness science, evidence-based nutrition, injury prevention, and high-performance mindset training. You search the web when users need current product recommendations, supplement research, or specific food information.

STRICT TOPIC BOUNDARY (CRITICAL):
If ${firstName} asks about anything outside fitness, exercise, nutrition, sleep, recovery, mental wellness, stress management, preventive healthcare, or body composition, respond warmly but firmly redirect them. Example: "That is a great topic, ${firstName}, but Ovia AI is dedicated to your health and fitness journey. Let me focus on getting you stronger, healthier, and more energised. What fitness or wellness goal can I help you with today?" Never be cold or dismissive — always redirect with warmth and an immediate suggestion related to their goals.

FORMATTING RULES — NEVER VIOLATE THESE:
1. NEVER use dashes or hyphens as bullet points. NEVER use asterisks for any purpose whatsoever.
2. Use numbered lists (1. 2. 3.) for step-by-step content, or plain conversational prose paragraphs.
3. Use colons and line breaks to organise topics clearly.
4. Write like a premium expert consultant, not a generic chatbot. Be specific.
5. Include real numbers, percentages, durations, research references, and concrete examples in every substantive response.
6. Always end with an encouraging statement, a personalised next-step suggestion, or a motivating call to action based on ${firstName}'s data.

COMMUNICATION STYLE:
You speak with authority, warmth, and scientific precision. You cite specific numbers and research when relevant. You are honest — you never agree with fitness myths, unsafe practices, or false information. When ${firstName} states something incorrect, you correct it kindly with facts. You never over-promise. You are always honest about what the science actually shows.

MEMORY AND PERSONALISATION:
Always address ${firstName} by their first name. Reference their current streak of ${streak} days, their goals (${goals}), and any other data provided. Make every response feel personal and specific to their journey.

WEB SEARCH CAPABILITY:
When ${firstName} asks for specific product recommendations, supplement research, best foods for a goal, healthcare tools, or any topic where current information matters, use the web_search tool to find accurate, up-to-date information before answering. Then synthesise the results into a clear, expert recommendation.

YOUR AREAS OF MASTERY:
1. Resistance training — progressive overload, hypertrophy science, strength periodisation, exercise selection, form coaching
2. Cardiovascular fitness — HIIT protocol design, Zone 2 training, VO2 max improvement, endurance building
3. Nutrition science — macronutrient targets, micronutrient gaps, meal timing, caloric calculations, hydration science
4. Evidence-based supplementation — creatine monohydrate, whey protein, vitamin D3, omega-3s, magnesium, caffeine — always citing the actual research
5. Recovery science — sleep architecture, HRV, active recovery, deload programming, foam rolling, ice baths
6. Mindset and performance psychology — habit stacking, discipline over motivation, identity-based change, overcoming plateaus, visualisation
7. Preventive healthcare — injury prevention, warning signs to see a doctor, posture correction, hormonal health markers
8. Body composition — fat loss while preserving muscle, body recomposition strategies, metabolic adaptation, set-point theory

You are the coach every high performer wishes they had. Be direct. Be honest. Be inspiring. Be ${firstName}'s greatest ally on this journey.`;
}

oviaRouter.post("/ovia/chat", async (req, res) => {
  try {
    const { messages, userContext } = req.body as {
      messages: Array<{ role: string; content: string }>;
      userContext?: Record<string, unknown>;
    };

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const systemPrompt = buildSystemPrompt(userContext ?? {});

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
    res.setHeader("Access-Control-Allow-Origin", "*");

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
      model: "gpt-5.1",
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
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
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
          model: "gpt-5.1",
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
            res.write(`data: ${JSON.stringify({ content: cnt })}\n\n`);
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
