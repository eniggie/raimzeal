import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const enrolledProgramRouter = Router();

const DAYS_PER_WEEK = 5;

enrolledProgramRouter.get("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data, error } = await supabaseAdmin
      .from("enrolled_programs")
      .select("*")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json({ enrollment: data ?? null });
  } catch (err) {
    logger.error({ err }, "GET /user/enrolled-program error");
    res.status(500).json({ error: "Could not fetch enrolled program." });
  }
});

const EnrollSchema = z.object({
  program_id: z.string().min(1),
  program_name: z.string().min(1).max(300),
  program_data: z.record(z.unknown()),
});

enrolledProgramRouter.post("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = EnrollSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { program_id, program_name, program_data } = parse.data;
  try {
    await supabaseAdmin
      .from("enrolled_programs")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("completed_at", null);

    const { data, error } = await supabaseAdmin
      .from("enrolled_programs")
      .insert({ user_id: userId, program_id, program_name, program_data, current_week: 1, current_day: 1 })
      .select()
      .single();
    if (error) throw error;
    res.json({ enrollment: data });
  } catch (err) {
    logger.error({ err }, "POST /user/enrolled-program error");
    res.status(500).json({ error: "Could not enroll in program." });
  }
});

enrolledProgramRouter.patch("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("enrolled_programs")
      .select("*")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!current) {
      res.json({ enrollment: null });
      return;
    }
    const row = current as {
      id: string;
      current_week: number;
      current_day: number;
      program_data: { durationWeeks?: number };
    };
    const durationWeeks: number = row.program_data?.durationWeeks ?? 8;
    let newDay = row.current_day + 1;
    let newWeek = row.current_week;
    let completedAt: string | null = null;
    if (newDay > DAYS_PER_WEEK) {
      newDay = 1;
      newWeek += 1;
    }
    if (newWeek > durationWeeks) {
      completedAt = new Date().toISOString();
    }
    const updates: Record<string, unknown> = { current_day: newDay, current_week: newWeek };
    if (completedAt) updates["completed_at"] = completedAt;
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("enrolled_programs")
      .update(updates)
      .eq("id", row.id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    res.json({ enrollment: updated });
  } catch (err) {
    logger.error({ err }, "PATCH /user/enrolled-program error");
    res.status(500).json({ error: "Could not advance program." });
  }
});

enrolledProgramRouter.delete("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    await supabaseAdmin
      .from("enrolled_programs")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("completed_at", null);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/enrolled-program error");
    res.status(500).json({ error: "Could not unenroll from program." });
  }
});

export default enrolledProgramRouter;
