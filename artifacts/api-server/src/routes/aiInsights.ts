import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middleware/auth";

const aiInsightsRouter = Router();

const DAILY_LIMIT = 8;
const insightDailyCounters = new Map<string, { count: number; resetAt: number }>();

function consumeInsightQuota(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = insightDailyCounters.get(userId);
  if (!entry || now > entry.resetAt) {
    insightDailyCounters.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }
  if (entry.count >= DAILY_LIMIT) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

interface HabitInsightData {
  habits: Array<{ name: string; streak: number; completedThisWeek: number; totalDays: number }>;
  completedToday: number;
  totalToday: number;
  weekCompletionRate: number;
}

interface SleepInsightData {
  weekEntries: Array<{ label: string; hours: number; quality: number }>;
  avgHours: number;
  goalHours: number;
  todayHours: number | null;
  todayQuality: number | null;
}

interface BalanceInsightData {
  todayMood: number;
  todayEnergy: number;
  todayStress: number;
  todayRecovery: number;
  readinessScore: number;
  readinessLabel: string;
  historyCount: number;
  avgMood7d: number | null;
  avgEnergy7d: number | null;
  avgStress7d: number | null;
  notes: string;
}

interface WeeklyReportData {
  workouts: number;
  avgCalories: number;
  avgProtein: number;
  avgSleep: number;
  sleepDays: number;
  avgReadiness: number;
  readinessDays: number;
  waterDays: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  topReadinessDays: number;
  workoutOnHighReadinessDays: number;
  workoutOnLowReadinessDays: number;
}

function buildHabitPrompt(d: HabitInsightData): string {
  const habitLines = d.habits.length > 0
    ? d.habits.map((h) => `${h.name}: ${h.streak}-day streak, ${h.completedThisWeek}/${h.totalDays} days this week`).join("; ")
    : "No habits tracked yet";
  return `You are Ovia AI — the world-class habit formation coach inside RAIMZEAL, a free non-profit fitness platform by Dr. Ephraim Oviawe (ECONTEUR LLC).

USER'S HABIT DATA:
Today: ${d.completedToday}/${d.totalToday} habits completed
7-day completion rate: ${Math.round(d.weekCompletionRate * 100)}%
Habit details: ${habitLines}

Give a SHORT, punchy, personalised habit formation coaching insight. Cover:
1. What their exact numbers reveal about their current habit patterns (be specific)
2. One science-backed technique to strengthen their weakest habit — choose the best fit from: implementation intention ("I will [habit] at [time] in [place]"), habit stacking ("After I [existing habit] I will [new habit]"), or temptation bundling
3. One specific action they can do RIGHT NOW today

Zero markdown. Use emojis freely. Short punchy sentences. Max 120 words. End with fire energy. 🔥`;
}

function buildSleepPrompt(d: SleepInsightData): string {
  const qualityLabels = ["Poor", "Bad", "Fair", "Good", "Great"];
  const entryLines = d.weekEntries.filter((e) => e.hours > 0)
    .map((e) => `${e.label}: ${e.hours.toFixed(1)}h (${qualityLabels[e.quality - 1] ?? "?"})`)
    .join("; ");

  return `You are Ovia AI — the world-class sleep science and recovery coach inside RAIMZEAL, a free non-profit fitness platform by Dr. Ephraim Oviawe (ECONTEUR LLC).

USER'S SLEEP DATA (last 7 days):
Goal: ${d.goalHours}h per night
7-day average: ${d.avgHours > 0 ? d.avgHours.toFixed(1) + "h" : "No data yet"}
${d.todayHours !== null ? `Tonight logged: ${d.todayHours.toFixed(1)}h (${qualityLabels[(d.todayQuality ?? 3) - 1]})` : "Tonight: not logged yet"}
Nightly breakdown: ${entryLines || "No sleep data logged yet"}

Give a SHORT, punchy, personalised sleep quality analysis and coaching insight. Cover:
1. What their sleep pattern specifically shows (avg vs goal, quality trend — use their actual numbers)
2. One evidence-based tip tailored precisely to their pattern — sleep debt recovery, consistency, or quality improvement — pick the most relevant
3. One action they can take TONIGHT to improve

Zero markdown. Use emojis freely. Short punchy sentences. Max 120 words. End with warm encouragement. 😴`;
}

function buildBalancePrompt(d: BalanceInsightData): string {
  const moodLabels = ["Awful", "Low", "Okay", "Good", "Great"];
  const energyLabels = ["Drained", "Tired", "Neutral", "Energised", "Fired up"];
  const stressLabels = ["Calm", "Low stress", "Moderate stress", "High stress", "Overwhelmed"];
  const recoveryLabels = ["Very sore", "Sore", "Some ache", "Good", "Fresh"];

  return `You are Ovia AI — the world-class life balance and wellness coach inside RAIMZEAL, a free non-profit fitness platform by Dr. Ephraim Oviawe (ECONTEUR LLC).

USER'S WELLNESS CHECK-IN DATA:
Today's readiness score: ${d.readinessScore}/100 (${d.readinessLabel})
Mood: ${moodLabels[d.todayMood - 1] ?? "?"} (${d.todayMood}/5)
Energy: ${energyLabels[d.todayEnergy - 1] ?? "?"} (${d.todayEnergy}/5)
Stress: ${stressLabels[d.todayStress - 1] ?? "?"} (${d.todayStress}/5)
Recovery: ${recoveryLabels[d.todayRecovery - 1] ?? "?"} (${d.todayRecovery}/5)
${d.avgMood7d !== null ? `7-day avg mood: ${d.avgMood7d.toFixed(1)}/5` : ""}
${d.avgEnergy7d !== null ? `7-day avg energy: ${d.avgEnergy7d.toFixed(1)}/5` : ""}
${d.avgStress7d !== null ? `7-day avg stress: ${d.avgStress7d.toFixed(1)}/5` : ""}
${d.notes ? `Today's notes: "${d.notes.slice(0, 200)}"` : ""}
Days logged this week: ${d.historyCount}

Give a SHORT, punchy, personalised life balance coaching insight. Cover:
1. What today's score and breakdown reveals about their current life balance (be direct and specific)
2. The single biggest imbalance to address right now (high stress + low energy? low mood? poor recovery?)
3. One concrete, actionable life balance strategy they can apply today

Zero markdown. Use emojis freely. Short punchy sentences. Max 130 words. End with high energy. ⚡`;
}

function buildWeeklyReportPrompt(d: WeeklyReportData): string {
  const mindBodySection = d.readinessDays >= 2
    ? `Mind-Body correlation: On high-readiness days (70+), user completed workouts ${d.workoutOnHighReadinessDays} time(s). On low-readiness days (<70), they completed ${d.workoutOnLowReadinessDays} workout(s).`
    : "Not enough wellness check-in data for mind-body correlation this week.";

  return `You are Ovia AI — the world-class AI wellness coach inside RAIMZEAL, a free non-profit fitness and health platform by Dr. Ephraim Oviawe (ECONTEUR LLC).

USER'S FULL WEEK SUMMARY:
Workouts completed: ${d.workouts}/7 days
Avg daily calories: ${d.avgCalories > 0 ? d.avgCalories + " kcal" : "not enough data"}
Avg daily protein: ${d.avgProtein > 0 ? d.avgProtein + "g" : "not enough data"}
Hydration (8+ glasses): ${d.waterDays}/7 days
Avg sleep: ${d.avgSleep > 0 ? d.avgSleep + "h" : "not logged"} across ${d.sleepDays} nights
Avg wellness readiness: ${d.avgReadiness > 0 ? d.avgReadiness + "/100" : "not logged"} across ${d.readinessDays} check-ins
${d.avgMood !== null ? `Avg mood this week: ${d.avgMood.toFixed(1)}/5` : ""}
${d.avgEnergy !== null ? `Avg energy this week: ${d.avgEnergy.toFixed(1)}/5` : ""}
${d.avgStress !== null ? `Avg stress this week: ${d.avgStress.toFixed(1)}/5` : ""}
${mindBodySection}

Write a SHORT, warm, highly personalised AI wellness narrative for this week. Structure it as:
1. A brief acknowledgement of what went well (be specific with their numbers)
2. The single most important pattern or trend you spotted (good or concerning — be honest)
3. One focused, actionable goal for next week based on their weakest area
4. A motivating closing line

Zero markdown. Use emojis. Conversational coach tone — direct but warm. Max 180 words. End with strong energy. 💪`;
}

aiInsightsRouter.post(
  "/api/ai/insights",
  requireAuth,
  async (req, res) => {
    const userId = (req as any).userId as string;

    const { allowed, remaining } = consumeInsightQuota(userId);
    if (!allowed) {
      res.status(429).json({ error: "Daily AI insight limit reached. Resets in 24 hours. ⏰" });
      return;
    }

    const { type, data } = req.body as { type: string; data: unknown };

    if (!type || !["habit", "sleep", "balance", "weekly_report"].includes(type)) {
      res.status(400).json({ error: "type must be habit, sleep, balance, or weekly_report" });
      return;
    }

    let prompt: string;
    try {
      if (type === "habit") prompt = buildHabitPrompt(data as HabitInsightData);
      else if (type === "sleep") prompt = buildSleepPrompt(data as SleepInsightData);
      else if (type === "weekly_report") prompt = buildWeeklyReportPrompt(data as WeeklyReportData);
      else prompt = buildBalancePrompt(data as BalanceInsightData);
    } catch {
      res.status(400).json({ error: "Invalid data payload" });
      return;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 350,
        temperature: 0.82,
      });

      const insight = completion.choices[0]?.message?.content?.trim() ?? "";
      res.json({ insight, remaining });
    } catch (err) {
      req.log?.error({ err }, "AI insights generation failed");
      res.status(500).json({ error: "AI insight generation failed — try again shortly." });
    }
  }
);

export default aiInsightsRouter;
