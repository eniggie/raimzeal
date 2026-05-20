import { logger } from "./logger";

const REQUIRED: string[] = [
  "PORT",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL: Array<{ key: string; feature: string }> = [
  { key: "DATABASE_URL", feature: "Stripe sync / drizzle DB" },
  { key: "STRIPE_WEBHOOK_SECRET", feature: "Stripe billing webhook verification" },
  { key: "SMTP_HOST", feature: "Email OTP delivery" },
  { key: "SMTP_USER", feature: "Email OTP delivery" },
  { key: "SMTP_PASS", feature: "Email OTP delivery" },
  { key: "TWILIO_ACCOUNT_SID", feature: "SMS OTP delivery" },
  { key: "TWILIO_AUTH_TOKEN", feature: "SMS OTP delivery" },
  { key: "TWILIO_FROM_NUMBER", feature: "SMS OTP delivery" },
];

export function validateEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error("[startup] FATAL — missing required environment variables:");
    for (const k of missing) {
      console.error(`  • ${k}`);
    }
    process.exit(1);
  }

  for (const { key, feature } of OPTIONAL) {
    if (!process.env[key]) {
      logger.warn(`[startup] Optional env var ${key} is not set — ${feature} will be degraded`);
    }
  }
}
