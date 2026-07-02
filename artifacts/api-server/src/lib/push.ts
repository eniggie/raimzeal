import { supabaseAdmin } from "./supabaseAdmin";
import { logger } from "./logger";

// Expo's push service accepts a plain HTTPS POST, so we avoid adding the
// expo-server-sdk dependency and call the endpoint directly.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo accepts up to 100 messages per request.

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Expo push tokens look like `ExponentPushToken[xxxxxxxx]` or `ExpoPushToken[…]`.
export function isExpoPushToken(t: unknown): t is string {
  return typeof t === "string" && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/** Delete a token that Expo reports is no longer valid, so we stop targeting it. */
async function pruneToken(token: string): Promise<void> {
  try {
    await supabaseAdmin.from("push_tokens").delete().eq("token", token);
  } catch (err) {
    logger.warn({ err }, "Failed to prune dead push token");
  }
}

/**
 * Send a push to an explicit list of Expo tokens. Invalid tokens are ignored;
 * tokens Expo reports as DeviceNotRegistered are pruned. Never throws — returns
 * how many messages Expo accepted.
 */
export async function sendPushToTokens(tokens: string[], msg: PushMessage): Promise<{ sent: number }> {
  const valid = Array.from(new Set(tokens.filter(isExpoPushToken)));
  if (valid.length === 0) return { sent: 0 };

  let sent = 0;
  for (let i = 0; i < valid.length; i += EXPO_BATCH_SIZE) {
    const chunk = valid.slice(i, i + EXPO_BATCH_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title: msg.title,
      body: msg.body,
      sound: "default" as const,
      data: msg.data ?? {},
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "Expo push endpoint returned non-OK");
        continue;
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket?.status === "ok") {
          sent++;
        } else if (ticket?.details?.error === "DeviceNotRegistered") {
          const dead = chunk[j];
          if (dead) await pruneToken(dead);
        } else if (ticket?.status === "error") {
          logger.warn({ error: ticket.details?.error, message: ticket.message }, "Expo push ticket error");
        }
      }
    } catch (err) {
      logger.warn({ err }, "Expo push send failed");
    }
  }

  return { sent };
}

/** Send a push to every device registered for a given user. */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<{ sent: number }> {
  const { data, error } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);

  if (error) {
    logger.warn({ err: error, userId }, "Failed to load push tokens for user");
    return { sent: 0 };
  }
  const tokens = (data ?? []).map((r) => r.token as string);
  return sendPushToTokens(tokens, msg);
}
