import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const exportRouter = Router();

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

exportRouter.get("/user/export", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const format = ((req.query.format as string) || "json").toLowerCase();

  try {
    const [profileRes, postsRes, commentsRes, prsRes, sleepRes, workoutLogsRes, mealLogsRes, bodyMeasRes, waterRes, scheduledRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,name,full_name,age,height,weight,fitness_level,goals,units,phone_verified,email_verified,country,city,created_at,updated_at").eq("id", userId).single(),
      supabaseAdmin.from("community_posts").select("*").eq("user_id", userId),
      supabaseAdmin.from("community_comments").select("*").eq("user_id", userId),
      supabaseAdmin.from("personal_records").select("*").eq("user_id", userId),
      supabaseAdmin.from("sleep_logs").select("*").eq("user_id", userId),
      supabaseAdmin.from("workout_logs").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabaseAdmin.from("meal_logs").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabaseAdmin.from("body_measurements").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabaseAdmin.from("water_intake").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabaseAdmin.from("scheduled_workouts").select("*").eq("user_id", userId).order("date", { ascending: true }),
    ]);

    const exportDate = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const sections: Record<string, Record<string, unknown>[]> = {
        profile: profileRes.data ? [profileRes.data as Record<string, unknown>] : [],
        community_posts: (postsRes.data ?? []) as Record<string, unknown>[],
        community_comments: (commentsRes.data ?? []) as Record<string, unknown>[],
        personal_records: (prsRes.data ?? []) as Record<string, unknown>[],
        sleep_logs: (sleepRes.data ?? []) as Record<string, unknown>[],
        workout_logs: (workoutLogsRes.data ?? []) as Record<string, unknown>[],
        meal_logs: (mealLogsRes.data ?? []) as Record<string, unknown>[],
        body_measurements: (bodyMeasRes.data ?? []) as Record<string, unknown>[],
        water_intake: (waterRes.data ?? []) as Record<string, unknown>[],
        scheduled_workouts: (scheduledRes.data ?? []) as Record<string, unknown>[],
      };

      const parts: string[] = [];
      for (const [table, rows] of Object.entries(sections)) {
        parts.push(`# ${table}`);
        parts.push(toCSV(rows) || "(no data)");
        parts.push("");
      }
      const csv = parts.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="raimzeal-export-${exportDate}.csv"`);
      res.send(csv);
    } else {
      const data = {
        exported_at: new Date().toISOString(),
        exported_by: "RAIMZEAL — Free forever. Your data belongs to you.",
        profile: profileRes.data ?? null,
        community_posts: postsRes.data ?? [],
        community_comments: commentsRes.data ?? [],
        personal_records: prsRes.data ?? [],
        sleep_logs: sleepRes.data ?? [],
        workout_logs: workoutLogsRes.data ?? [],
        meal_logs: mealLogsRes.data ?? [],
        body_measurements: bodyMeasRes.data ?? [],
        water_intake: waterRes.data ?? [],
        scheduled_workouts: scheduledRes.data ?? [],
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="raimzeal-export-${exportDate}.json"`);
      res.json(data);
    }
  } catch (err) {
    logger.error({ err }, "GET /user/export error");
    res.status(500).json({ error: "Export failed. Please try again." });
  }
});

export default exportRouter;
