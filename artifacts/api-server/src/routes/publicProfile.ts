import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const publicProfileRouter = Router();

const HandleSchema = /^[a-z0-9_]{3,30}$/;

publicProfileRouter.get("/profile/:handle", async (req, res) => {
  const { handle } = req.params;
  if (!HandleSchema.test(handle)) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id,name,handle,public_profile_enabled,public_show_streak,public_show_workouts,public_show_badges,fitness_level,goals,created_at")
      .eq("handle", handle)
      .eq("public_profile_enabled", true)
      .is("deleted_at", null)
      .single();

    if (!data) { res.status(404).json({ error: "Profile not found." }); return; }

    const row = data as Record<string, unknown>;
    const profile: Record<string, unknown> = {
      handle: row.handle,
      name: row.name,
      goals: row.goals,
      fitness_level: row.fitness_level,
      member_since: row.created_at,
    };

    res.json({ profile });
  } catch (err) {
    logger.error({ err }, "GET /profile/:handle error");
    res.status(500).json({ error: "Could not fetch profile." });
  }
});

const PublicProfileSchema = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,30}$/, "Handle must be 3-30 chars, lowercase letters, numbers, underscores only").optional().nullable(),
  public_profile_enabled: z.boolean().optional(),
  public_show_streak: z.boolean().optional(),
  public_show_workouts: z.boolean().optional(),
  public_show_badges: z.boolean().optional(),
});

publicProfileRouter.put("/user/public-profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = PublicProfileSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." }); return; }

  const updates = parse.data;

  if (updates.handle) {
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("handle", updates.handle)
      .neq("id", userId)
      .maybeSingle();
    if (existing) { res.status(409).json({ error: "That handle is already taken. Try another." }); return; }
  }

  try {
    await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
    res.json({ success: true, ...updates });
  } catch (err) {
    logger.error({ err }, "PUT /user/public-profile error");
    res.status(500).json({ error: "Could not update public profile settings." });
  }
});

publicProfileRouter.get("/user/public-profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("handle,public_profile_enabled,public_show_streak,public_show_workouts,public_show_badges")
      .eq("id", userId)
      .single();
    res.json(data ?? {});
  } catch (err) {
    logger.error({ err }, "GET /user/public-profile error");
    res.status(500).json({ error: "Could not fetch public profile settings." });
  }
});

export default publicProfileRouter;
