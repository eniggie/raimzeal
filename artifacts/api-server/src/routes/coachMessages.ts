import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const coachMessagesRouter = Router();

const MAX_HISTORY = 60;

coachMessagesRouter.get("/user/coach-messages", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const limit = Math.min(Number(req.query.limit) || MAX_HISTORY, MAX_HISTORY);
  try {
    const { data, error } = await supabaseAdmin
      .from("coach_messages")
      .select("id,role,content,is_weekly,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    // Return chronological order so client can append directly
    res.json({ messages: (data ?? []).reverse() });
  } catch (err) {
    logger.error({ err }, "GET /user/coach-messages error");
    res.status(500).json({ error: "Could not fetch coach messages." });
  }
});

const MessageSchema = z.object({
  role: z.enum(["user", "coach"]),
  content: z.string().min(1).max(8000),
  is_weekly: z.boolean().default(false),
});

const BatchSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(10),
});

// Save a batch of messages (typically a user+coach pair after each exchange)
coachMessagesRouter.post("/user/coach-messages/batch", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = BatchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }

  const rows = parse.data.messages.map(m => ({
    user_id: userId,
    role: m.role,
    content: m.content,
    is_weekly: m.is_weekly,
  }));

  try {
    const { data, error } = await supabaseAdmin
      .from("coach_messages")
      .insert(rows)
      .select("id,role,content,is_weekly,created_at");
    if (error) throw error;
    res.json({ messages: data ?? [] });
  } catch (err) {
    logger.error({ err }, "POST /user/coach-messages/batch error");
    res.status(500).json({ error: "Could not save coach messages." });
  }
});

export default coachMessagesRouter;
