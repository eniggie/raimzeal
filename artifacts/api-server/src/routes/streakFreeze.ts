import { Router } from "express";
import pg from "pg";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const streakFreezeRouter = Router();

// Shared pool for atomic streak-freeze operations.
// We bypass the Supabase JS client here because PostgREST does not support
// column expressions in UPDATE (e.g. col = col - 1), which are required for
// a race-free decrement. The pool re-uses the existing DATABASE_URL secret.
const _pool = new pg.Pool({
  connectionString: process.env["DATABASE_URL"]?.replace(/:6543\//, ":5432/"),
  max: 3,
  idleTimeoutMillis: 30_000,
});

streakFreezeRouter.get("/user/streak", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("streak_freezes_available")
      .eq("id", userId)
      .single();
    const row = data as { streak_freezes_available: number | null } | null;
    res.json({ streak_freezes_available: row?.streak_freezes_available ?? 0 });
  } catch (err) {
    logger.error({ err }, "GET /user/streak error");
    res.status(500).json({ error: "Could not fetch streak data." });
  }
});

streakFreezeRouter.post("/user/streak/freeze", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    // Atomic decrement — PostgreSQL evaluates the WHERE condition and the SET
    // expression in the same statement, so concurrent requests cannot both
    // "see" a positive count and both consume a freeze.
    const { rows } = await _pool.query<{ streak_freezes_available: number }>(
      `UPDATE profiles
          SET streak_freezes_available = streak_freezes_available - 1
        WHERE id = $1
          AND streak_freezes_available > 0
        RETURNING streak_freezes_available`,
      [userId]
    );

    if (rows.length === 0) {
      res.status(400).json({ error: "No streak freezes available. Keep logging workouts to earn freezes!" });
      return;
    }

    const remaining = rows[0].streak_freezes_available;
    logger.info({ userId, remaining }, "Streak freeze used");
    res.json({ success: true, streak_freezes_available: remaining, message: "Streak freeze applied! Your streak is safe." });
  } catch (err) {
    logger.error({ err }, "POST /user/streak/freeze error");
    res.status(500).json({ error: "Could not apply streak freeze." });
  }
});

// grant-freeze is reserved for server-side reward flows (e.g. milestone achievements).
// Direct user calls are blocked to prevent self-granting abuse.
streakFreezeRouter.post("/user/streak/grant-freeze", requireAuth, (_req, res) => {
  res.status(403).json({ error: "Streak freezes are awarded automatically through in-app milestones." });
});

export default streakFreezeRouter;
