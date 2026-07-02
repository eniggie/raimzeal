import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { sendWelcomeEmail } from "./email";
import {
  authSendCodeRateLimit,
  emailVerifyRateLimit,
  generalWriteRateLimit,
} from "../lib/rateLimiter";

const authRouter = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const SendSmsCodeSchema = z.object({
  phoneE164: z.string().optional(),
});

const VerifySmsCodeSchema = z.object({
  code: z.string().min(1, "code is required."),
});

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.errors[0]?.message ?? "Invalid request body." };
  }
  return { ok: true, data: result.data };
}

// ─── Twilio ─────────────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (!sid || !token || !from) {
    throw new Error("SMS is not available at this time. Please skip this step and verify later.");
  }
  const twilio = (await import("twilio")).default;
  const client = twilio(sid, token);
  await client.messages.create({ body, from, to });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── POST /api/auth/sync-profile ──────────────────────────────────────────────
// Called automatically by the web client on every SIGNED_IN event.
// Upserts the profiles row from Supabase user_metadata so contact info
// collected during signup is persisted to the database.

authRouter.post("/auth/sync-profile", requireAuth, generalWriteRateLimit, async (req, res) => {
  const userId = req.userId as string;
  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const user = userData.user;
    const meta = user.user_metadata ?? {};

    // Only persist fields that metadata actually provides. Writing `null` for an
    // absent field would clobber values the user later set via the profile editor
    // or Ovia (which update `profiles` directly, never auth metadata) on every
    // sign-in — and would violate the NOT NULL constraint on `name`. This upsert
    // is therefore purely additive: it backfills signup contact info, never erases.
    const metaName = meta.full_name ?? meta.name;
    const payload: Record<string, unknown> = {
      id: userId,
      email_verified: !!user.email_confirmed_at,
      updated_at: new Date().toISOString(),
    };
    if (metaName != null && metaName !== "") {
      payload["name"] = metaName;
      payload["full_name"] = metaName;
    }
    if (meta.phone != null) payload["phone"] = meta.phone;
    if (meta.phone_e164 != null) payload["phone_e164"] = meta.phone_e164;
    if (meta.country != null) payload["country"] = meta.country;
    if (meta.city != null) payload["city"] = meta.city;

    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(payload, { onConflict: "id", ignoreDuplicates: false });

    if (upsertError) {
      req.log?.warn({ err: upsertError }, "Profile upsert error — non-fatal");
    }

    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/sync-profile error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/send-sms-code (requires auth) ────────────────────────────

authRouter.post("/auth/send-sms-code", authSendCodeRateLimit, requireAuth, async (req, res) => {
  try {
    const userId = req.userId as string;
    const parsed = parseBody(SendSmsCodeSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const phoneE164 = parsed.data.phoneE164 ?? userData?.user?.user_metadata?.phone_e164 ?? "";

    if (!phoneE164) { res.status(400).json({ error: "No phone number on file." }); return; }

    const code = generateCode();

    try {
      await sendSms(phoneE164, `Your RAIMZEAL verification code: ${code}. Expires in 10 minutes.`);
    } catch (err: unknown) {
      req.log?.warn({ err }, "Failed to send SMS OTP");
      res.status(503).json({ error: "SMS is not available at this time. Please skip this step and verify later." });
      return;
    }

    // Store code hash after successful send so failed sends don't burn rate-limit quota
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabaseAdmin.from("verification_codes").insert({
      user_id: userId,
      channel: "sms",
      code_hash: hash,
      expires_at: expiresAt,
    });

    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/send-sms-code error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/verify-sms-code (requires auth) ──────────────────────────

authRouter.post("/auth/verify-sms-code", emailVerifyRateLimit, requireAuth, async (req, res) => {
  try {
    const userId = req.userId as string;
    const parsed = parseBody(VerifySmsCodeSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { code } = parsed.data;

    const { data: rows } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", "sms")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (!rows || rows.length === 0) {
      res.status(400).json({ error: "Code expired or not found. Request a new one." });
      return;
    }

    const row = rows[0];

    if (row.attempts >= 5) {
      res.status(400).json({ error: "Too many incorrect attempts. Request a new code." });
      return;
    }

    await supabaseAdmin.from("verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(String(code), row.code_hash);
    if (!valid) {
      res.status(400).json({ error: "Incorrect code. Please try again." });
      return;
    }

    await supabaseAdmin.from("verification_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    await supabaseAdmin.from("profiles").update({ phone_verified: true, updated_at: new Date().toISOString() }).eq("id", userId);
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { phone_verified: true },
    });

    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/verify-sms-code error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/welcome-email (unauthenticated, rate-limited) ─────────────
// Sends the branded RAIMZEAL welcome email at signup time.
// No auth required because the user's session is null when email confirmation
// is required — the Supabase token is only issued after they click the link.
// Rate-limited to 5 req/min per IP to prevent abuse.

// ─── POST /api/auth/send-email-code (unauthenticated, rate-limited) ───────────
// Sends a 6-digit OTP to the supplied email via Supabase's native OTP flow.
// Returns 400 for invalid/missing email, 200 on success.

const SendEmailCodeSchema = z.object({
  email: z.string().email("Invalid email address."),
});

authRouter.post("/auth/send-email-code", authSendCodeRateLimit, async (req, res) => {
  try {
    const parsed = parseBody(SendEmailCodeSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

    const { email } = parsed.data;

    // Trigger Supabase's built-in email OTP. shouldCreateUser:false means the
    // OTP only works for existing accounts (sign-in flow, not registration).
    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      req.log?.warn({ err: otpError }, "POST /auth/send-email-code — Supabase OTP error (non-fatal)");
    }

    // Always return success to prevent email enumeration
    req.log?.info({ email }, "POST /auth/send-email-code — OTP requested");
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/send-email-code error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/welcome-email ─────────────────────────────────────────────

const WelcomeEmailSchema = z.object({
  email: z.string().email("Invalid email address."),
  name: z.string().min(1).max(100, "Name too long."),
});

authRouter.post("/auth/welcome-email", authSendCodeRateLimit, async (req, res) => {
  const parsed = parseBody(WelcomeEmailSchema, req.body);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  const { email, name } = parsed.data;

  try {
    await sendWelcomeEmail(email, name);
    req.log?.info({ email }, "POST /auth/welcome-email — branded welcome sent");
    res.json({ success: true });
  } catch (err) {
    // Log but return 200 so a missing SMTP config never blocks user registration
    req.log?.warn({ err }, "POST /auth/welcome-email — send failed (non-fatal)");
    res.json({ success: false, warning: "Email send failed — SMTP may not be configured." });
  }
});

export default authRouter;
