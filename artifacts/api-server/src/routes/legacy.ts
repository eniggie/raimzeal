import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, legacyPartnerships, healthReports } from "@workspace/db";
import { eq, and, or, ne, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";
import { communityMutateLimitHeavy, communityMutateLimitLight } from "../lib/rateLimiter";

const legacyRouter = Router();

// requireLegacy kept for signature compatibility but now passes all authenticated users
function requireLegacy(_req: Request, _res: Response, next: NextFunction) {
  next();
}

// ── GET /api/legacy/leaderboard ───────────────────────────────────────────────
// Returns top 25 active Legacy members ranked by streak → total workouts.
legacyRouter.get("/legacy/leaderboard", requireAuth, requireLegacy, async (req, res) => {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, handle, streak, created_at")
    .eq("subscription_tier", "legacy")
    .eq("subscription_status", "active")
    .order("streak", { ascending: false })
    .limit(25);

  if (error) {
    logger.error({ error }, "GET /legacy/leaderboard profiles query failed");
    res.status(500).json({ error: "Could not load leaderboard." });
    return;
  }

  const entries = await Promise.all((profiles ?? []).map(async (p) => {
    const { count } = await supabaseAdmin
      .from("workout_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p.id);
    return {
      id:           p.id,
      name:         (p.full_name as string) || "Legacy Member",
      handle:       p.handle as string | null,
      streak:       (p.streak as number) ?? 0,
      workoutCount: count ?? 0,
      memberSince:  p.created_at as string,
    };
  }));

  // Sort by streak desc, workoutCount desc as tiebreaker
  entries.sort((a, b) => b.streak - a.streak || b.workoutCount - a.workoutCount);

  res.json({ entries });
});

// ── GET /api/legacy/certificate ───────────────────────────────────────────────
// Returns founding member data: name, member number, member-since date.
legacyRouter.get("/legacy/certificate", requireAuth, requireLegacy, async (req, res) => {
  const userId = (req as any).userId as string;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name, handle, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    res.status(500).json({ error: "Could not load profile." });
    return;
  }

  // Member number = count of Legacy members whose account predates this one
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("subscription_tier", "legacy")
    .lt("created_at", profile.created_at as string);

  res.json({
    name:         (profile.full_name as string) || "Legacy Member",
    handle:       profile.handle as string | null,
    memberNumber: (count ?? 0) + 1,
    memberSince:  profile.created_at as string,
  });
});

// ── POST /api/legacy/community/image-upload-url ───────────────────────────────
legacyRouter.post(
  "/legacy/community/image-upload-url",
  requireAuth,
  requireLegacy,
  communityMutateLimitHeavy,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { ext } = req.body as { ext?: unknown };
    const safeExt =
      typeof ext === "string" && /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
    const path = `legacy/${userId}/${randomUUID()}.${safeExt}`;

    await supabaseAdmin.storage.createBucket("community-images", {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      fileSizeLimit: 10 * 1024 * 1024,
    });

    const { data, error } = await supabaseAdmin.storage
      .from("community-images")
      .createSignedUploadUrl(path);

    if (error || !data) {
      req.log.error({ error }, "Failed to create Legacy image upload URL");
      res.status(500).json({ error: "Failed to create upload URL" });
      return;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("community-images")
      .getPublicUrl(path);

    res.json({ uploadUrl: data.signedUrl, publicUrl });
  }
);

// ── POST /api/legacy/community/posts ─────────────────────────────────────────
// Creates a Legacy Inner Circle post (is_legacy_post = true).
legacyRouter.post(
  "/legacy/community/posts",
  requireAuth,
  requireLegacy,
  communityMutateLimitHeavy,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { userName, content, postType, imageUrl } = req.body as {
      userName?: unknown; content?: unknown; postType?: unknown; imageUrl?: unknown;
    };

    if (typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content is required" }); return;
    }
    if (typeof userName !== "string" || !userName.trim()) {
      res.status(400).json({ error: "userName is required" }); return;
    }
    if (postType !== "post" && postType !== "question" && postType !== "win" && postType !== "tip" && postType !== "challenge") {
      res.status(400).json({ error: "postType must be 'post', 'question', 'win', 'tip', or 'challenge'" }); return;
    }
    if (content.trim().length > 2000) {
      res.status(400).json({ error: "content too long (max 2000 characters)" }); return;
    }
    const safeImageUrl =
      typeof imageUrl === "string" && imageUrl.startsWith("https://") ? imageUrl : null;

    const { data, error } = await supabaseAdmin
      .from("community_posts")
      .insert({
        user_id:        userId,
        user_name:      userName.trim().slice(0, 60),
        content:        content.trim(),
        post_type:      postType,
        is_legacy_post: true,
        ...(safeImageUrl ? { image_url: safeImageUrl } : {}),
      })
      .select()
      .single();

    if (error || !data) {
      req.log.error({ error }, "Failed to create Legacy community post");
      res.status(500).json({ error: "Failed to create post" }); return;
    }
    res.status(201).json({ post: data });
  }
);

// ── GET /api/legacy/health-report/latest ─────────────────────────────────────
legacyRouter.get("/legacy/health-report/latest", requireAuth, requireLegacy, async (req, res) => {
  const userId = (req as any).userId as string;

  const [latest] = await db
    .select()
    .from(healthReports)
    .where(eq(healthReports.userId, userId))
    .orderBy(desc(healthReports.createdAt))
    .limit(1);

  res.json({ report: latest ?? null });
});

// ── POST /api/legacy/health-report/generate ───────────────────────────────────
// Gathers this month's data for the user and asks Ovia to write a health report.
legacyRouter.post("/legacy/health-report/generate", requireAuth, requireLegacy, async (req, res) => {
  const userId = (req as any).userId as string;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = now.toISOString().slice(0, 10);
  const periodLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Gather data in parallel
  const [
    profileRes,
    workoutsRes,
    mealsRes,
    measurementsRes,
    sleepRes,
    prsRes,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name, streak, fitness_level, goals, blood_type, genotype, weight, height").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("workout_logs").select("workout_name, date, duration, calories_burned").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false }),
    supabaseAdmin.from("meal_logs").select("date, calories, protein, carbs, fat").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabaseAdmin.from("body_measurements").select("date, weight, chest, waist, hips").eq("user_id", userId).order("date", { ascending: false }).limit(5),
    supabaseAdmin.from("sleep_logs").select("date, hours, quality").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabaseAdmin.from("personal_records").select("exercise_name, value, unit").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
  ]);

  const profile = profileRes.data;
  const workouts = workoutsRes.data ?? [];
  const meals = mealsRes.data ?? [];
  const measurements = measurementsRes.data ?? [];
  const sleepLogs = sleepRes.data ?? [];
  const prs = prsRes.data ?? [];

  const totalCalsBurned = workouts.reduce((s, w) => s + ((w.calories_burned as number) || 0), 0);
  const totalWorkoutMins = workouts.reduce((s, w) => s + ((w.duration as number) || 0), 0);
  const avgCaloriesIn = meals.length
    ? Math.round(meals.reduce((s, m) => s + ((m.calories as number) || 0), 0) / meals.length)
    : null;
  const avgProtein = meals.length
    ? Math.round(meals.reduce((s, m) => s + ((m.protein as number) || 0), 0) / meals.length)
    : null;
  const avgSleep = sleepLogs.length
    ? (sleepLogs.reduce((s, l) => s + ((l.hours as number) || 0), 0) / sleepLogs.length).toFixed(1)
    : null;

  const systemPrompt = `You are Ovia, RAIMZEAL's AI health coach. Write a warm, motivating, and insightful monthly health report for a Legacy member. Use markdown with clear sections. Be specific and reference the actual numbers provided. End with 3 personalised action points for next month. Do not include any PII or unnecessary disclaimers beyond a brief "always consult a healthcare professional for medical decisions."`;

  const userMessage = `
Generate a Monthly Health Report for ${periodLabel}.

Member: ${(profile?.full_name as string) || "Legacy Member"}
Goals: ${(profile?.goals as string) || "Not specified"}
Fitness Level: ${(profile?.fitness_level as string) || "Not specified"}
Current Streak: ${(profile?.streak as number) ?? 0} days

WORKOUTS THIS MONTH (${workouts.length} sessions):
- Total time: ${totalWorkoutMins} minutes
- Calories burned: ${totalCalsBurned} kcal
${workouts.slice(0, 5).map((w) => `- ${w.date}: ${w.workout_name} (${w.duration} min)`).join("\n")}

NUTRITION (${meals.length} meals logged):
- Avg daily calories: ${avgCaloriesIn ?? "not logged"} kcal
- Avg daily protein: ${avgProtein ?? "not logged"} g

BODY MEASUREMENTS (recent):
${measurements.slice(0, 3).map((m) => `- ${m.date}: weight ${m.weight ?? "—"}, waist ${m.waist ?? "—"}`).join("\n") || "No measurements logged this month"}

SLEEP (${sleepLogs.length} nights logged):
- Avg: ${avgSleep ?? "not logged"} hours/night

PERSONAL RECORDS:
${prs.slice(0, 5).map((r) => `- ${r.exercise_name}: ${r.value} ${r.unit}`).join("\n") || "No records"}

Write a comprehensive, encouraging report covering: what went well, areas to improve, nutrition insights, recovery observations, and 3 specific action points for next month.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1200,
    });

    const content = completion.choices[0]?.message?.content ?? "Report could not be generated.";

    // Cache the report
    const [saved] = await db.insert(healthReports).values({
      id:          randomUUID(),
      userId,
      periodLabel,
      content,
    }).returning();

    logger.info({ userId, periodLabel }, "Legacy health report generated");
    res.json({ report: saved });
  } catch (err) {
    logger.error({ err, userId }, "Legacy health report generation failed");
    res.status(500).json({ error: "Could not generate health report. Please try again." });
  }
});

// ── POST /api/legacy/coaching-plan ───────────────────────────────────────────
// Generates a personalised 4-week training + nutrition plan via Ovia AI.
legacyRouter.post("/legacy/coaching-plan", requireAuth, requireLegacy, async (req, res) => {
  const userId = (req as any).userId as string;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, fitness_level, goals, weight, height, age, blood_type, genotype")
    .eq("id", userId)
    .maybeSingle();

  const systemPrompt = `You are Ovia, RAIMZEAL's AI health coach. Create detailed, safe, and motivating 4-week personalised fitness and nutrition plans. Use markdown with clear week-by-week breakdowns. Always include a brief safety note. Keep plans realistic for the member's stated level.`;

  const userMessage = `
Create a personalised 4-week fitness and nutrition plan for:
- Name: ${(profile?.full_name as string) || "Legacy Member"}
- Fitness Level: ${(profile?.fitness_level as string) || "Not specified"}
- Goals: ${(profile?.goals as string) || "General health and fitness"}
- Weight: ${(profile?.weight as number) ?? "Not specified"}
- Height: ${(profile?.height as number) ?? "Not specified"}
- Age: ${(profile?.age as number) ?? "Not specified"}

Include:
1. Weekly workout schedule (days, exercises, sets/reps, duration)
2. Daily nutrition targets (calories, protein, carbs, fat)
3. Weekly focus themes
4. Recovery and sleep recommendations
5. Progress checkpoints at weeks 2 and 4

Keep it actionable, achievable, and aligned with RAIMZEAL's fitness and food therapy philosophy.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1400,
    });

    const plan = completion.choices[0]?.message?.content ?? "Plan could not be generated.";
    logger.info({ userId }, "Legacy coaching plan generated");
    res.json({ plan });
  } catch (err) {
    logger.error({ err, userId }, "Legacy coaching plan generation failed");
    res.status(500).json({ error: "Could not generate coaching plan. Please try again." });
  }
});

// ── GET /api/legacy/partner ───────────────────────────────────────────────────
legacyRouter.get("/legacy/partner", requireAuth, requireLegacy, async (req, res) => {
  const userId = (req as any).userId as string;

  const [partnership] = await db
    .select()
    .from(legacyPartnerships)
    .where(
      and(
        or(
          eq(legacyPartnerships.userId1, userId),
          eq(legacyPartnerships.userId2, userId),
        ),
        ne(legacyPartnerships.status, "ended"),
      )
    )
    .orderBy(desc(legacyPartnerships.createdAt))
    .limit(1);

  if (!partnership) {
    res.json({ partner: null, status: "none" });
    return;
  }

  const partnerId = partnership.userId1 === userId ? partnership.userId2 : partnership.userId1;
  const partnerName = partnership.userId1 === userId ? partnership.userName2 : partnership.userName1;

  res.json({
    partner: { id: partnerId, name: partnerName },
    status: partnership.status,
    partnershipId: partnership.id,
    createdAt: partnership.createdAt,
  });
});

// ── POST /api/legacy/partner/request ─────────────────────────────────────────
// Request an accountability partner. If another Legacy member is waiting, auto-match.
legacyRouter.post(
  "/legacy/partner/request",
  requireAuth,
  requireLegacy,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { userName } = req.body as { userName?: unknown };

    if (typeof userName !== "string" || !userName.trim()) {
      res.status(400).json({ error: "userName is required" }); return;
    }

    // Check if already in an active or pending partnership
    const [existing] = await db
      .select()
      .from(legacyPartnerships)
      .where(
        and(
          or(
            eq(legacyPartnerships.userId1, userId),
            eq(legacyPartnerships.userId2, userId),
          ),
          ne(legacyPartnerships.status, "ended"),
        )
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "You already have an active or pending partnership.", existing });
      return;
    }

    // Find another pending user to match with
    const [waiting] = await db
      .select()
      .from(legacyPartnerships)
      .where(
        and(
          eq(legacyPartnerships.status, "pending"),
          ne(legacyPartnerships.userId1, userId),
        )
      )
      .orderBy(legacyPartnerships.createdAt)
      .limit(1);

    if (waiting) {
      // Match found — activate the partnership
      const [matched] = await db
        .update(legacyPartnerships)
        .set({
          userId2:   userId,
          userName2: userName.trim().slice(0, 60),
          status:    "active",
        })
        .where(eq(legacyPartnerships.id, waiting.id))
        .returning();

      logger.info({ userId, partnerId: waiting.userId1 }, "Legacy accountability partner matched");
      res.status(201).json({
        partnership: matched,
        matched: true,
        partner: { id: waiting.userId1, name: waiting.userName1 },
      });
      return;
    }

    // No one waiting — create a pending request
    const [created] = await db
      .insert(legacyPartnerships)
      .values({
        id:        randomUUID(),
        userId1:   userId,
        userId2:   "pending",
        userName1: userName.trim().slice(0, 60),
        userName2: "pending",
        status:    "pending",
      })
      .returning();

    logger.info({ userId }, "Legacy accountability partner request queued");
    res.status(201).json({ partnership: created, matched: false, partner: null });
  }
);

// ── POST /api/legacy/partner/end ─────────────────────────────────────────────
legacyRouter.post("/legacy/partner/end", requireAuth, requireLegacy, async (req, res) => {
  const userId = (req as any).userId as string;

  await db
    .update(legacyPartnerships)
    .set({ status: "ended" })
    .where(
      and(
        or(
          eq(legacyPartnerships.userId1, userId),
          eq(legacyPartnerships.userId2, userId),
        ),
        ne(legacyPartnerships.status, "ended"),
      )
    );

  res.json({ ended: true });
});

export default legacyRouter;
