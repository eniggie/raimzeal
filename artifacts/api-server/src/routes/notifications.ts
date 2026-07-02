import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { generalWriteRateLimit } from "../lib/rateLimiter";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { isExpoPushToken, sendPushToUser } from "../lib/push";

const notificationsRouter = Router();

const RegisterSchema = z.object({
  token: z.string().min(1),
  platform: z.string().max(20).optional(),
});

// POST /api/notifications/register-token — store this device's Expo push token
// for the authenticated user. Upsert on the token so a device that re-registers
// (or changes owner) is re-pointed at the current user rather than duplicated.
notificationsRouter.post("/notifications/register-token", requireAuth, generalWriteRateLimit, async (req, res) => {
  const parse = RegisterSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  const { token, platform } = parse.data;
  if (!isExpoPushToken(token)) {
    res.status(400).json({ error: "Invalid Expo push token format." });
    return;
  }

  const userId = req.userId as string;
  try {
    const { error } = await supabaseAdmin
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, platform: platform ?? null, updated_at: new Date().toISOString() },
        { onConflict: "token" },
      );
    if (error) {
      req.log?.error({ err: error }, "register-token upsert failed");
      res.status(500).json({ error: "Could not register device." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /notifications/register-token error");
    res.status(500).json({ error: "Could not register device." });
  }
});

// POST /api/notifications/unregister-token — remove a device token (e.g. on
// logout or when the user disables notifications). Scoped to the caller's own
// tokens so one user can't unregister another's device.
notificationsRouter.post("/notifications/unregister-token", requireAuth, generalWriteRateLimit, async (req, res) => {
  const { token } = req.body as { token?: unknown };
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  const userId = req.userId as string;
  try {
    await supabaseAdmin.from("push_tokens").delete().eq("token", token).eq("user_id", userId);
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /notifications/unregister-token error");
    res.status(500).json({ error: "Could not unregister device." });
  }
});

// POST /api/notifications/test — send a test push to the caller's own devices.
// Lets the app offer a "Send test notification" button that exercises the full
// server → Expo → device path.
notificationsRouter.post("/notifications/test", requireAuth, generalWriteRateLimit, async (req, res) => {
  const userId = req.userId as string;
  try {
    const { sent } = await sendPushToUser(userId, {
      title: "🎉 RAIMZEAL notifications are on",
      body: "You'll get gentle nudges to keep your health streak alive. Let's go! 💪",
      data: { type: "test" },
    });
    if (sent === 0) {
      res.status(404).json({ error: "No registered device found for this account." });
      return;
    }
    res.json({ success: true, sent });
  } catch (err) {
    req.log?.error({ err }, "POST /notifications/test error");
    res.status(500).json({ error: "Could not send test notification." });
  }
});

export default notificationsRouter;
