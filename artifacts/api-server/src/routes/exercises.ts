import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const exercisesRouter = Router();

exercisesRouter.get("/exercises", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("exercises")
      .select("id,name,muscle_group,description,video_url")
      .order("name");
    if (error) throw error;
    res.json({ exercises: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /exercises error");
    res.status(500).json({ error: "Could not fetch exercises." });
  }
});

exercisesRouter.get("/exercises/:name", async (req, res) => {
  const name = decodeURIComponent(req.params["name"] as string);
  try {
    const { data, error } = await supabaseAdmin
      .from("exercises")
      .select("id,name,muscle_group,description,video_url")
      .ilike("name", name)
      .maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: "Exercise not found." }); return; }
    res.json({ exercise: data });
  } catch (err) {
    logger.error({ err }, "GET /exercises/:name error");
    res.status(500).json({ error: "Could not fetch exercise." });
  }
});

export default exercisesRouter;
