import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const waterIntakeRouter = Router();

waterIntakeRouter.get("/user/water-intake", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const limit = Math.min(Number(req.query.limit) || 30, 90);
  try {
    const { data, error } = await supabaseAdmin
      .from("water_intake")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ intake: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/water-intake error");
    res.status(500).json({ error: "Could not fetch water intake." });
  }
});

const WaterIntakeSchema = z.object({
  glasses: z.number().int().min(0).max(50),
});

waterIntakeRouter.put("/user/water-intake/:date", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const date = req.params["date"] as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    return;
  }
  const parse = WaterIntakeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { glasses } = parse.data;
  try {
    const { data, error } = await supabaseAdmin
      .from("water_intake")
      .upsert({ user_id: userId, date, glasses }, { onConflict: "user_id,date" })
      .select()
      .single();
    if (error) throw error;
    res.json({ intake: data });
  } catch (err) {
    logger.error({ err }, "PUT /user/water-intake/:date error");
    res.status(500).json({ error: "Could not save water intake." });
  }
});

export default waterIntakeRouter;
