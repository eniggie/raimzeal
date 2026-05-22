import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const streakFreezeRouter = Router();

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
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("streak_freezes_available")
      .eq("id", userId)
      .single();
    const row = profile as { streak_freezes_available: number | null } | null;
    const available = row?.streak_freezes_available ?? 0;

    if (available <= 0) {
      res.status(400).json({ error: "No streak freezes available. Keep logging workouts to earn freezes!" });
      return;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ streak_freezes_available: available - 1 })
      .eq("id", userId);

    logger.info({ userId, remaining: available - 1 }, "Streak freeze used");
    res.json({ success: true, streak_freezes_available: available - 1, message: "Streak freeze applied! Your streak is safe." });
  } catch (err) {
    logger.error({ err }, "POST /user/streak/freeze error");
    res.status(500).json({ error: "Could not apply streak freeze." });
  }
});

streakFreezeRouter.post("/user/streak/grant-freeze", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("streak_freezes_available")
      .eq("id", userId)
      .single();
    const row = profile as { streak_freezes_available: number | null } | null;
    const current = row?.streak_freezes_available ?? 0;
    const newCount = Math.min(current + 1, 5);

    await supabaseAdmin
      .from("profiles")
      .update({ streak_freezes_available: newCount })
      .eq("id", userId);

    res.json({ success: true, streak_freezes_available: newCount });
  } catch (err) {
    logger.error({ err }, "POST /user/streak/grant-freeze error");
    res.status(500).json({ error: "Could not grant streak freeze." });
  }
});

export default streakFreezeRouter;
