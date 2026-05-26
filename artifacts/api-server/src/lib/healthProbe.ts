import nodemailer from "nodemailer";
import { logger } from "./logger";

const PRODUCTION_BASE = "https://www.raimzeal.com";

const PAGE_PROBES = [
  { label: "/community", path: "/community" },
  { label: "/membership", path: "/membership" },
  { label: "/settings", path: "/settings" },
  { label: "/billing", path: "/billing" },
];

const DONATION_URL = "https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00";

export interface ProbeResult {
  label: string;
  url: string;
  ok: boolean;
  status?: number;
  reason?: string;
}

async function probePage(label: string, url: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    if (res.status >= 500) {
      return { label, url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }

    const text = await res.text().catch(() => "");
    if (text.includes("AccessDenied") || text.includes("<Error>") || text.includes("<Code>AccessDenied")) {
      return { label, url, ok: false, status: res.status, reason: "Response body contains AccessDenied error" };
    }

    return { label, url, ok: true, status: res.status };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { label, url, ok: false, reason };
  }
}

async function probeDonationUrl(): Promise<ProbeResult> {
  const label = "Stripe Donate URL";
  const url = DONATION_URL;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    const ok = res.ok || (res.status >= 300 && res.status < 400);
    if (!ok) {
      return { label, url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }
    return { label, url, ok: true, status: res.status };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { label, url, ok: false, reason };
  }
}

async function probeStripeStatus(): Promise<ProbeResult> {
  const label = "Stripe Status (prices configured)";
  const url = `${PRODUCTION_BASE}/api/stripe/status`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status >= 500) {
      return { label, url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }
    const json = await res.json().catch(() => null) as { available?: boolean } | null;
    if (json && json.available === false) {
      return {
        label,
        url,
        ok: false,
        status: res.status,
        reason: "Stripe prices not configured — checkout will return 503",
      };
    }
    return { label, url, ok: true, status: res.status };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { label, url, ok: false, reason };
  }
}

function buildAlertHtml(failures: ProbeResult[], checkedAt: string): string {
  const rows = failures
    .map(
      (f) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e22;color:#e8e8ec;font-weight:600;">${f.label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e22;color:#9ca3af;font-size:12px;word-break:break-all;">${f.url}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e22;color:#f87171;">${f.reason ?? `HTTP ${f.status ?? "unknown"}`}</td>
      </tr>`,
    )
    .join("");

  return `
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Checked at ${checkedAt} UTC</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#f87171;">⚠️ Donation / Payment Health Alert</p>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e8e8ec;">
      The automated health probe detected <strong style="color:#f87171;">${failures.length} failing check${failures.length !== 1 ? "s" : ""}</strong>
      on <strong>raimzeal.com</strong>. The donate button or related routes may be broken.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e1e22;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#1a1a1e;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">Check</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">URL</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">Reason</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9ca3af;">
      <strong style="color:#e8e8ec;">Action required:</strong> Check the API server logs, Stripe integration, and cloud storage configuration.
      The previous incident was caused by AccessDenied XML being returned instead of a Stripe redirect — look for that pattern first.
    </p>

    <p style="margin:0;font-size:12px;color:#4b5563;">
      This alert is sent automatically every time the 15-minute probe finds a failure.
      It will stop once all checks pass.
    </p>
  `;
}

async function sendAlertEmail(failures: ProbeResult[]): Promise<void> {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const alertTo = process.env["ALERT_EMAIL"] ?? user;

  if (!host || !user || !pass || !alertTo) {
    logger.warn(
      { failureCount: failures.length },
      "Health probe failures detected but SMTP not configured — cannot send alert email",
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const checkedAt = new Date().toUTCString();
  const subject = `🚨 RAIMZEAL Health Alert — Donate/Billing Route Failure`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:16px;overflow:hidden;border:1px solid #1e1e22;">
          <tr>
            <td style="background:linear-gradient(135deg,#1a0505 0%,#1a0a0a 100%);padding:24px 32px;border-bottom:2px solid #f87171;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="https://raimzeal.com/favicon.png" alt="RAIMZEAL" style="width:52px;height:52px;border-radius:13px;display:block;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">RAIMZEAL</p>
                    <p style="margin:3px 0 0;font-size:12px;color:#f87171;font-weight:600;letter-spacing:0.3px;">⚠️ Health Alert — Team Notification</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${buildAlertHtml(failures, checkedAt)}
              <hr style="border:none;border-top:1px solid #1e1e22;margin:28px 0 20px;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <a href="https://www.raimzeal.com/api/stripe/status" style="display:inline-block;background:#2E8B57;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;margin-right:8px;">Check Stripe Status →</a>
                    <a href="https://www.raimzeal.com/membership" style="display:inline-block;background:#1e293b;color:#94a3b8;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">Check Membership Page →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.8;text-align:center;">
                Automated alert · RAIMZEAL · Operated by ECONTEUR LLC<br />
                <a href="https://www.raimzeal.com" style="color:#6b7280;text-decoration:none;">raimzeal.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"RAIMZEAL Health Monitor" <${user}>`,
    to: alertTo,
    subject,
    html: htmlBody,
    text: [
      `RAIMZEAL Health Alert — ${checkedAt}`,
      "",
      `${failures.length} check(s) failed:`,
      ...failures.map((f) => `  • ${f.label}: ${f.reason ?? `HTTP ${f.status}`} (${f.url})`),
      "",
      "Please review the API server logs and Stripe integration immediately.",
    ].join("\n"),
  });
}

export async function runDonationHealthProbe(): Promise<void> {
  logger.info("Donation health probe starting");

  const results = await Promise.all([
    ...PAGE_PROBES.map((p) => probePage(p.label, `${PRODUCTION_BASE}${p.path}`)),
    probeDonationUrl(),
    probeStripeStatus(),
  ]);

  const failures = results.filter((r) => !r.ok);

  if (failures.length === 0) {
    logger.info({ checks: results.length }, "Donation health probe passed — all checks OK");
    return;
  }

  logger.warn(
    {
      failureCount: failures.length,
      failures: failures.map((f) => ({ label: f.label, reason: f.reason, status: f.status })),
    },
    "Donation health probe detected failures — sending alert",
  );

  try {
    await sendAlertEmail(failures);
    logger.info({ alertTo: process.env["ALERT_EMAIL"] ?? process.env["SMTP_USER"] }, "Health alert email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send health alert email");
  }
}
