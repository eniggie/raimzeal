import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";
import { generalWriteRateLimit } from "../lib/rateLimiter";

const bodyMeasurementsRouter = Router();

bodyMeasurementsRouter.get("/user/body-measurements", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const limit = Math.min(Number(req.query.limit) || 100, 365);
  try {
    const { data, error } = await supabaseAdmin
      .from("body_measurements")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ measurements: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/body-measurements error");
    res.status(500).json({ error: "Could not fetch body measurements." });
  }
});

const BodyMeasurementSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  weight: z.number().positive(),
  chest: z.number().positive().optional().nullable(),
  waist: z.number().positive().optional().nullable(),
  hips: z.number().positive().optional().nullable(),
  arms: z.number().positive().optional().nullable(),
  thighs: z.number().positive().optional().nullable(),
});

bodyMeasurementsRouter.post("/user/body-measurements", requireAuth, generalWriteRateLimit, async (req, res) => {
  const userId = req.userId as string;
  const parse = BodyMeasurementSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { id, date, weight, chest, waist, hips, arms, thighs } = parse.data;

  try {
    // Ownership check: reject if a different user already owns this ID.
    if (id) {
      const { data: existing } = await supabaseAdmin
        .from("body_measurements")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (existing) {
        const row = existing as { id: string; user_id: string };
        if (row.user_id !== userId) {
          res.status(403).json({ error: "Forbidden." });
          return;
        }
        res.json({ measurement: existing });
        return;
      }
    }

    // If no id, also check for an existing measurement on the same date for this user
    if (!id) {
      const { data: byDate } = await supabaseAdmin
        .from("body_measurements")
        .select("id,user_id")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      if (byDate) {
        // Update existing measurement for that date
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("body_measurements")
          .update({ weight, chest: chest ?? null, waist: waist ?? null, hips: hips ?? null, arms: arms ?? null, thighs: thighs ?? null })
          .eq("id", (byDate as { id: string }).id)
          .eq("user_id", userId)
          .select()
          .single();
        if (updateErr) throw updateErr;
        res.json({ measurement: updated });
        return;
      }
    }

    const row: Record<string, unknown> = {
      user_id: userId, date, weight,
      chest: chest ?? null, waist: waist ?? null,
      hips: hips ?? null, arms: arms ?? null, thighs: thighs ?? null,
    };
    if (id) row["id"] = id;

    const { data, error } = await supabaseAdmin
      .from("body_measurements")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.json({ measurement: data });
  } catch (err) {
    logger.error({ err }, "POST /user/body-measurements error");
    res.status(500).json({ error: "Could not save body measurement." });
  }
});

bodyMeasurementsRouter.delete("/user/body-measurements/:id", requireAuth, generalWriteRateLimit, async (req, res) => {
  const userId = req.userId as string;
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from("body_measurements")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/body-measurements/:id error");
    res.status(500).json({ error: "Could not delete body measurement." });
  }
});

export default bodyMeasurementsRouter;
