import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const mealLogsRouter = Router();

mealLogsRouter.get("/user/meal-logs", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  try {
    const { data, error } = await supabaseAdmin
      .from("meal_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ logs: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/meal-logs error");
    res.status(500).json({ error: "Could not fetch meal logs." });
  }
});

const MealLogSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  name: z.string().min(1).max(300),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

mealLogsRouter.post("/user/meal-logs", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = MealLogSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { id, date, name, calories, protein, carbs, fat, meal_type } = parse.data;

  try {
    // Ownership check: if id is provided, ensure it doesn't already belong to another user.
    if (id) {
      const { data: existing } = await supabaseAdmin
        .from("meal_logs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (existing) {
        const row = existing as { id: string; user_id: string };
        if (row.user_id !== userId) {
          res.status(403).json({ error: "Forbidden." });
          return;
        }
        res.json({ log: existing });
        return;
      }
    }

    const row: Record<string, unknown> = { user_id: userId, date, name, calories, protein, carbs, fat, meal_type };
    if (id) row["id"] = id;

    const { data, error } = await supabaseAdmin
      .from("meal_logs")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.json({ log: data });
  } catch (err) {
    logger.error({ err }, "POST /user/meal-logs error");
    res.status(500).json({ error: "Could not save meal log." });
  }
});

mealLogsRouter.put("/user/meal-logs/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const parse = MealLogSchema.omit({ id: true }).safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { date, name, calories, protein, carbs, fat, meal_type } = parse.data;
  try {
    const { data, error } = await supabaseAdmin
      .from("meal_logs")
      .update({ date, name, calories, protein, carbs, fat, meal_type })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ log: data });
  } catch (err) {
    logger.error({ err }, "PUT /user/meal-logs/:id error");
    res.status(500).json({ error: "Could not update meal log." });
  }
});

mealLogsRouter.delete("/user/meal-logs/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from("meal_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/meal-logs/:id error");
    res.status(500).json({ error: "Could not delete meal log." });
  }
});

export default mealLogsRouter;
