import nodemailer from "nodemailer";
import { logger } from "./logger";

type EmailProvider = "resend" | "postmark" | "smtp" | "none";

type MailTransportConfig = {
  provider: Exclude<EmailProvider, "none">;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

type EmailConfigStatus = {
  configured: boolean;
  provider: EmailProvider | "multi";
  providers: EmailProvider[];
  primary?: EmailProvider;
  fallbackCount: number;
  from?: string;
  missing: string[];
};

type SendAppEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html: string;
  fromName?: string;
  replyTo?: string;
};

function cleanDisplayName(name: string): string {
  return name.replace(/["<>]/g, "").trim() || "RAIMZEAL";
}

function getVerifiedFrom(...candidates: Array<string | undefined>): string | undefined {
  return candidates.find((value) => value?.includes("@"));
}

function dedupeConfigs(configs: MailTransportConfig[]): MailTransportConfig[] {
  const seen = new Set<string>();
  return configs.filter((config) => {
    const key = `${config.provider}:${config.host}:${config.user}:${config.from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMailTransports(): MailTransportConfig[] {
  const from = getVerifiedFrom(
    process.env["RESEND_FROM"],
    process.env["POSTMARK_FROM"],
    process.env["SMTP_FROM"],
    process.env["EMAIL_FROM"],
  );

  const configs: MailTransportConfig[] = [];
  const resendApiKey = process.env["RESEND_API_KEY"];
  if (resendApiKey && from) {
    configs.push({
      provider: "resend",
      host: "smtp.resend.com",
      port: Number(process.env["RESEND_SMTP_PORT"] ?? "587"),
      secure: Number(process.env["RESEND_SMTP_PORT"] ?? "587") === 465,
      user: "resend",
      pass: resendApiKey,
      from,
    });
  }

  const postmarkToken = process.env["POSTMARK_SERVER_TOKEN"] ?? process.env["POSTMARK_API_TOKEN"];
  const postmarkUser = process.env["POSTMARK_SMTP_USER"] ?? postmarkToken;
  const postmarkPass = process.env["POSTMARK_SMTP_PASS"] ?? postmarkToken;
  const postmarkFrom = getVerifiedFrom(process.env["POSTMARK_FROM"], from);
  if (postmarkUser && postmarkPass && postmarkFrom) {
    configs.push({
      provider: "postmark",
      host: "smtp.postmarkapp.com",
      port: Number(process.env["POSTMARK_SMTP_PORT"] ?? "587"),
      secure: Number(process.env["POSTMARK_SMTP_PORT"] ?? "587") === 465,
      user: postmarkUser,
      pass: postmarkPass,
      from: postmarkFrom,
    });
  }

  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpFrom = getVerifiedFrom(process.env["SMTP_FROM"], from);
  if (smtpHost && smtpUser && smtpPass && smtpFrom) {
    configs.push({
      provider: smtpHost === "smtp.resend.com" || smtpUser === "resend" ? "resend" : "smtp",
      host: smtpHost,
      port: Number(process.env["SMTP_PORT"] ?? "587"),
      secure: Number(process.env["SMTP_PORT"] ?? "587") === 465,
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom,
    });
  }

  const backupHost = process.env["BACKUP_SMTP_HOST"];
  const backupUser = process.env["BACKUP_SMTP_USER"];
  const backupPass = process.env["BACKUP_SMTP_PASS"];
  const backupFrom = getVerifiedFrom(process.env["BACKUP_SMTP_FROM"], from);
  if (backupHost && backupUser && backupPass && backupFrom) {
    configs.push({
      provider: "smtp",
      host: backupHost,
      port: Number(process.env["BACKUP_SMTP_PORT"] ?? "587"),
      secure: Number(process.env["BACKUP_SMTP_PORT"] ?? "587") === 465,
      user: backupUser,
      pass: backupPass,
      from: backupFrom,
    });
  }

  return dedupeConfigs(configs);
}

function hasAnyMailCredentials(): boolean {
  const hasResend = Boolean(process.env["RESEND_API_KEY"]);
  const hasPostmark = Boolean(
    process.env["POSTMARK_SERVER_TOKEN"] ||
    process.env["POSTMARK_API_TOKEN"] ||
    (process.env["POSTMARK_SMTP_USER"] && process.env["POSTMARK_SMTP_PASS"]),
  );
  const hasSmtp = Boolean(process.env["SMTP_HOST"] && process.env["SMTP_USER"] && process.env["SMTP_PASS"]);
  const hasBackupSmtp = Boolean(
    process.env["BACKUP_SMTP_HOST"] &&
    process.env["BACKUP_SMTP_USER"] &&
    process.env["BACKUP_SMTP_PASS"],
  );

  return hasResend || hasPostmark || hasSmtp || hasBackupSmtp;
}

export function getEmailConfigStatus(): EmailConfigStatus {
  const transports = getMailTransports();
  const from = getVerifiedFrom(
    process.env["RESEND_FROM"],
    process.env["POSTMARK_FROM"],
    process.env["SMTP_FROM"],
    process.env["EMAIL_FROM"],
    process.env["BACKUP_SMTP_FROM"],
  );

  const missing = [
    !hasAnyMailCredentials() ? "RESEND_API_KEY, POSTMARK_SERVER_TOKEN, or SMTP credentials" : null,
    !from ? "RESEND_FROM, POSTMARK_FROM, SMTP_FROM, EMAIL_FROM, or BACKUP_SMTP_FROM" : null,
  ].filter((value): value is string => Boolean(value));
  const providers = transports.map((transport) => transport.provider);

  return {
    configured: transports.length > 0 && missing.length === 0,
    provider: providers.length > 1 ? "multi" : providers[0] ?? "none",
    providers,
    primary: providers[0],
    fallbackCount: Math.max(0, providers.length - 1),
    from: transports[0]?.from ?? from,
    missing,
  };
}

export function assertEmailConfigured(): EmailConfigStatus {
  const status = getEmailConfigStatus();
  if (!status.configured) {
    throw new Error(`Email service is not configured. Missing ${status.missing.join(", ")}.`);
  }
  return status;
}

export async function sendAppEmail(options: SendAppEmailOptions): Promise<void> {
  const status = assertEmailConfigured();
  const transports = getMailTransports();
  let lastError: unknown;

  for (const config of transports) {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    try {
      await transport.sendMail({
        from: `"${cleanDisplayName(options.fromName ?? "RAIMZEAL")}" <${config.from}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      });
      return;
    } catch (err) {
      lastError = err;
      logger.error(
        { err, provider: config.provider, host: config.host, fallbackAvailable: transports.indexOf(config) < transports.length - 1 },
        "[email] Provider send failed",
      );
    }
  }

  throw lastError ?? new Error(`Email service is not configured. Missing ${status.missing.join(", ")}.`);
}
