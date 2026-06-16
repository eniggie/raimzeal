import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { sendAppEmail } from "../lib/mailer";
import {
  authSignupLoginRateLimit,
  authSendCodeRateLimit,
  emailVerifyRateLimit,
} from "../lib/rateLimiter";

const authRouter = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const SignupSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().min(1, "fullName is required."),
  phone: z.string().optional(),
  phoneE164: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(1, "Password is required."),
});

const AppleLoginSchema = z.object({
  identityToken: z.string().min(1, "Apple identity token is required."),
  email: z.string().email("Invalid email address.").optional().nullable(),
  fullName: z.string().optional().nullable(),
});

const SendEmailCodeSchema = z.object({
  email: z.string().email("Invalid email address."),
});

const VerifyEmailCodeSchema = z.object({
  email: z.string().email("Invalid email address."),
  code: z.string().min(1, "code is required."),
});

const SendSmsCodeSchema = z.object({
  phoneE164: z.string().optional(),
});

const VerifySmsCodeSchema = z.object({
  code: z.string().min(1, "code is required."),
});

// CSRF NOTE: All authenticated endpoints below require an `Authorization: Bearer <JWT>`
// header. Browsers cannot attach custom Authorization headers in cross-site requests
// without CORS pre-flight, which is already blocked by our strict CORS config. No
// session cookies are used, so CSRF tokens are unnecessary.

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.errors[0]?.message ?? "Invalid request body." };
  }
  return { ok: true, data: result.data };
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await sendAppEmail({ fromName: "RAIMZEAL", to, subject, html });
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

async function storeCode(userId: string, channel: "email" | "sms", code: string): Promise<void> {
  const hash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabaseAdmin.from("verification_codes").insert({
    user_id: userId,
    channel,
    code_hash: hash,
    expires_at: expiresAt,
  });
}

async function checkRateLimit(
  userId: string,
  channel: "email" | "sms"
): Promise<{ limited: boolean; message: string }> {
  const now = new Date();
  const min60 = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const min1 = new Date(now.getTime() - 60 * 1000).toISOString();

  const { count: count1 } = await supabaseAdmin
    .from("verification_codes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", channel)
    .gte("created_at", min1);

  if ((count1 ?? 0) >= 1) {
    return { limited: true, message: "Please wait 60 seconds before requesting a new code." };
  }

  const { count: countHour } = await supabaseAdmin
    .from("verification_codes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", channel)
    .gte("created_at", min60);

  if ((countHour ?? 0) >= 5) {
    return { limited: true, message: "Too many codes requested. Please try again later." };
  }

  return { limited: false, message: "" };
}

type AuthUser = NonNullable<
  Awaited<ReturnType<typeof supabaseAdmin.auth.admin.listUsers>>["data"]
>["users"][number];

async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  logger.warn({ email }, "[auth] User lookup exceeded pagination search limit");
  return null;
}

function authSessionPayload(data: {
  session: {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
  };
  user: {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  };
}) {
  const { session, user } = data;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata,
    },
  };
}

// ─── OTP email HTML ──────────────────────────────────────────────────────────

function emailOtpHtml(code: string, name: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0a0a0b;color:#f5f5f5;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#111;border-radius:16px;padding:32px;">
    <img src="https://raimzeal.com/favicon.png" alt="RAIMZEAL" style="width:64px;height:64px;border-radius:16px;margin-bottom:24px;display:block;" />
    <h1 style="color:#2E8B57;margin:0 0 8px;">Verify your email</h1>
    <p style="color:#aaa;margin:0 0 24px;">Hi ${name || "there"}, use the code below to verify your RAIMZEAL account.</p>
    <div style="background:#1a1a1a;border:2px solid #2E8B57;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#2E8B57;">${code}</span>
    </div>
    <p style="color:#666;font-size:13px;margin:0;">This code expires in 10 minutes. If you didn't sign up for RAIMZEAL, ignore this email.</p>
  </div>
</body>
</html>`;
}

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

authRouter.post("/auth/signup", authSignupLoginRateLimit, async (req, res) => {
  try {
    const parsed = parseBody(SignupSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { email, password, fullName, phone, phoneE164, country, city } = parsed.data;

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // accounts start unverified; OTP flow sets this to true via /auth/verify-email-code
      user_metadata: {
        full_name: fullName,
        name: fullName,
        phone: phone ?? "",
        phone_e164: phoneE164 ?? "",
        country: country ?? "",
        city: city ?? "",
        phone_verified: false,
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
        let existingUser: AuthUser | null = null;
        try {
          existingUser = await findUserByEmail(email);
        } catch (err) {
          req.log?.warn({ err }, "Failed to look up existing user after signup conflict");
        }

        if (existingUser && !existingUser.email_confirmed_at) {
          const rl = await checkRateLimit(existingUser.id, "email");
          if (rl.limited) { res.status(429).json({ error: rl.message }); return; }

          const emailCode = generateCode();
          try {
            await sendEmail(email, "Your RAIMZEAL verification code", emailOtpHtml(emailCode, fullName));
            await storeCode(existingUser.id, "email", emailCode);
            res.json({ success: true });
          } catch (err) {
            req.log?.error({ err }, "Failed to resend verification email for existing unverified signup");
            res.status(503).json({ error: "Email verification is temporarily unavailable. Please contact support or try again later." });
          }
          return;
        }

        res.status(409).json({ error: "An account with this email already exists." });
      } else {
        req.log?.warn({ err: createError }, "Supabase createUser error");
        res.status(400).json({ error: "Could not create account. Please try again." });
      }
      return;
    }

    const userId = userData.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      name: fullName,
      full_name: fullName,
      phone: phone ?? null,
      phone_e164: phoneE164 ?? null,
      country: country ?? null,
      city: city ?? null,
      phone_verified: false,
      email_verified: false,
      updated_at: new Date().toISOString(),
      // created_at intentionally omitted — the DB column default sets it on INSERT
      // and including it here would overwrite the original timestamp on any re-upsert.
    });

    const emailCode = generateCode();
    try {
      await sendEmail(email, "Your RAIMZEAL verification code", emailOtpHtml(emailCode, fullName));
      await storeCode(userId, "email", emailCode);
    } catch (err) {
      req.log?.error({ err }, "Failed to send verification email — aborting signup");
      await supabaseAdmin.from("profiles").delete().eq("id", userId).then(
        () => undefined,
        (cleanupErr) => req.log?.warn({ err: cleanupErr }, "Failed to clean up profile after email send failure")
      );
      await supabaseAdmin.auth.admin.deleteUser(userId).then(
        () => undefined,
        (cleanupErr) => req.log?.warn({ err: cleanupErr }, "Failed to clean up auth user after email send failure")
      );
      res.status(503).json({ error: "Email verification is temporarily unavailable. Please contact support or try again later." });
      return;
    }

    if (phoneE164) {
      const smsCode = generateCode();
      await storeCode(userId, "sms", smsCode);
      sendSms(phoneE164, `Your RAIMZEAL verification code: ${smsCode}. Expires in 10 minutes.`).catch((err) =>
        req.log?.warn({ err }, "Failed to send SMS")
      );
    }

    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/signup error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post("/auth/login", authSignupLoginRateLimit, async (req, res) => {
  try {
    const parsed = parseBody(LoginSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { email, password } = parsed.data;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    res.json(authSessionPayload(data));
  } catch (err) {
    req.log?.error({ err }, "POST /auth/login error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/apple ─────────────────────────────────────────────────────

authRouter.post("/auth/apple", authSignupLoginRateLimit, async (req, res) => {
  try {
    const parsed = parseBody(AppleLoginSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { identityToken, email, fullName } = parsed.data;

    const { data, error } = await supabaseAdmin.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });

    if (error || !data.session || !data.user) {
      req.log?.warn({ err: error }, "Apple sign-in failed");
      res.status(401).json({ error: "Apple sign-in failed. Please try again." });
      return;
    }

    const resolvedName =
      fullName?.trim() ||
      (typeof data.user.user_metadata?.["full_name"] === "string" ? data.user.user_metadata["full_name"] : "") ||
      (typeof data.user.user_metadata?.["name"] === "string" ? data.user.user_metadata["name"] : "") ||
      data.user.email?.split("@")[0] ||
      email?.split("@")[0] ||
      "RAIMZEAL Member";

    await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      name: resolvedName,
      full_name: resolvedName,
      email_verified: Boolean(data.user.email_confirmed_at),
      updated_at: new Date().toISOString(),
      // created_at intentionally omitted — overwriting it on every Apple sign-in
      // would corrupt the original account creation timestamp.
    });

    res.json(authSessionPayload(data));
  } catch (err) {
    req.log?.error({ err }, "POST /auth/apple error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/send-email-code ──────────────────────────────────────────

authRouter.post("/auth/send-email-code", authSendCodeRateLimit, async (req, res) => {
  try {
    const parsed = parseBody(SendEmailCodeSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { email } = parsed.data;

    let user: AuthUser | null = null;
    try {
      user = await findUserByEmail(email);
    } catch (err) {
      req.log?.warn({ err }, "Failed to look up user for email OTP resend");
      res.status(500).json({ error: "Failed to look up user." });
      return;
    }

    // Always return success regardless of whether the email is registered.
    // Returning 404 for unknown emails would let attackers enumerate which
    // addresses are in the system by probing this endpoint.
    if (!user) { res.json({ success: true }); return; }

    const rl = await checkRateLimit(user.id, "email");
    if (rl.limited) { res.status(429).json({ error: rl.message }); return; }

    const code = generateCode();
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
    try {
      await sendEmail(email, "Your RAIMZEAL verification code", emailOtpHtml(code, name));
    } catch (err: unknown) {
      req.log?.warn({ err }, "Failed to send email OTP resend");
      res.status(503).json({ error: "Email verification is temporarily unavailable. Please contact support or try again later." });
      return;
    }

    // Store only after successful send so failed sends don't burn rate-limit quota
    await storeCode(user.id, "email", code);
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/send-email-code error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/verify-email-code ────────────────────────────────────────

authRouter.post("/auth/verify-email-code", emailVerifyRateLimit, async (req, res) => {
  try {
    const parsed = parseBody(VerifyEmailCodeSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { email, code } = parsed.data;

    let user: AuthUser | null = null;
    try {
      user = await findUserByEmail(email);
    } catch (err) {
      req.log?.warn({ err }, "Failed to look up user for email OTP verification");
      res.status(500).json({ error: "Failed to look up user." });
      return;
    }
    if (!user) { res.status(400).json({ error: "Code expired or not found. Request a new one." }); return; }

    const { data: rows } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel", "email")
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

    const valid = await bcrypt.compare(String(code), row.code_hash);
    if (!valid) {
      res.status(400).json({ error: "Incorrect code. Please try again." });
      return;
    }

    await supabaseAdmin.from("verification_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
    await supabaseAdmin.from("profiles").update({ email_verified: true, updated_at: new Date().toISOString() }).eq("id", user.id);

    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/verify-email-code error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/send-sms-code (requires auth) ────────────────────────────

authRouter.post("/auth/send-sms-code", authSendCodeRateLimit, requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const parsed = parseBody(SendSmsCodeSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const phoneE164 = parsed.data.phoneE164 ?? userData?.user?.user_metadata?.phone_e164 ?? "";

    if (!phoneE164) { res.status(400).json({ error: "No phone number on file." }); return; }

    const rl = await checkRateLimit(userId, "sms");
    if (rl.limited) { res.status(429).json({ error: rl.message }); return; }

    const code = generateCode();

    try {
      await sendSms(phoneE164, `Your RAIMZEAL verification code: ${code}. Expires in 10 minutes.`);
    } catch (err: unknown) {
      req.log?.warn({ err }, "Failed to send SMS OTP");
      res.status(503).json({ error: "SMS is not available at this time. Please skip this step and verify later." });
      return;
    }

    // Store only after successful send so failed attempts don't burn rate-limit quota
    await storeCode(userId, "sms", code);
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "POST /auth/send-sms-code error");
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/verify-sms-code (requires auth) ──────────────────────────

authRouter.post("/auth/verify-sms-code", emailVerifyRateLimit, requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
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

export default authRouter;
