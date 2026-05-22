import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const sleepRouter = Router();

sleepRouter.get("/user/sleep-logs", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const limit = Math.min(Number(req.query.limit) || 30, 90);
  try {
    const { data, error } = await supabaseAdmin
      .from("sleep_logs")
      .select("*")
      .eq("user_id", userId)
      .order("slept_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ logs: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/sleep-logs error");
    res.status(500).json({ error: "Could not fetch sleep logs." });
  }
});

const SleepLogSchema = z.object({
  slept_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "slept_at must be YYYY-MM-DD"),
  hours: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
});

sleepRouter.post("/user/sleep-logs", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = SleepLogSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." }); return; }
  const { slept_at, hours, quality, notes } = parse.data;
  try {
    const { data, error } = await supabaseAdmin
      .from("sleep_logs")
      .upsert({ user_id: userId, slept_at, hours, quality, notes: notes ?? null }, { onConflict: "user_id,slept_at" })
      .select()
      .single();
    if (error) throw error;
    res.json({ log: data });
  } catch (err) {
    logger.error({ err }, "POST /user/sleep-logs error");
    res.status(500).json({ error: "Could not save sleep log." });
  }
});

sleepRouter.delete("/user/sleep-logs/:date", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const date = req.params["date"] as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: "Invalid date format." }); return; }
  try {
    await supabaseAdmin.from("sleep_logs").delete().eq("user_id", userId).eq("slept_at", date);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/sleep-logs/:date error");
    res.status(500).json({ error: "Could not delete sleep log." });
  }
});

export default sleepRouter;
