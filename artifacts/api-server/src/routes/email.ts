import { Router } from "express";
import nodemailer from "nodemailer";

const emailRouter = Router();

const MOTIVATION_MESSAGES = [
  "Every day you show up for your health is a victory. Keep going, {name}!",
  "Your future self is thanking you right now for not giving up, {name}.",
  "Progress is not always visible in the mirror — but it's always happening inside. Trust your journey, {name}.",
  "Small steps every day lead to massive transformations. You're doing great, {name}!",
  "Champions are made on the days when quitting feels easiest. Be a champion today, {name}.",
  "Your body can take almost anything — it's your mind you need to convince. You've got this, {name}!",
  "One meal, one workout, one glass of water at a time — you're building your best life, {name}.",
  "The only workout you regret is the one you didn't do. Today is your day, {name}!",
  "Consistency beats perfection every single time. Show up today, {name}.",
  "Results take time. Trust the process and keep logging your meals and workouts, {name}.",
  "Strength is not just physical. Every healthy choice you make reflects your mental toughness, {name}.",
  "You are one workout away from a better mood. Move your body today, {name}.",
  "The difference between who you are and who you want to be is what you do right now, {name}.",
  "Discipline is choosing your long-term health over short-term comfort. Stay disciplined, {name}.",
  "Great things are built brick by brick. You're laying yours, {name}. Keep building.",
];

const FITNESS_TIPS = [
  "Tip for {name}: Eating 1.6–2.2g of protein per kg of bodyweight daily optimises muscle protein synthesis.",
  "Tip for {name}: Aim for 7–9 hours of sleep — poor sleep increases hunger hormones by up to 24%.",
  "Tip for {name}: Drinking 500ml of water before meals reduces calorie intake by approximately 13%.",
  "Tip for {name}: Progressive overload — adding 2.5–5kg to your lifts each week — is the #1 driver of muscle growth.",
  "Tip for {name}: Zone 2 cardio (conversational pace) 3× per week powerfully builds your aerobic base.",
  "Tip for {name}: Magnesium glycinate 200–400mg before bed improves sleep quality and reduces muscle cramps.",
  "Tip for {name}: A 10-minute walk after meals reduces blood glucose spikes by up to 30%.",
  "Tip for {name}: Strength training 3× per week is as effective for fat loss as cardio — and preserves more muscle.",
  "Tip for {name}: Creatine monohydrate 3–5g daily is the most research-backed performance supplement. It works.",
  "Tip for {name}: 150–300 minutes of moderate-intensity activity per week is the WHO's recommendation for optimal health.",
];

function pickMessage(pool: string[], userName: string): string {
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].replace(/{name}/g, userName.split(" ")[0]);
}

function createTransporter() {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function buildHtmlEmail(subject: string, bodyText: string, userName: string): string {
  return `<!DOCTYPE html>
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
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:16px;overflow:hidden;border:1px solid #1e1e22;">
          <tr>
            <td style="background:#2E8B57;padding:24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">RAIMZEAL</p>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Your AI-powered fitness coach</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e8e8ec;">${bodyText}</p>
              <hr style="border:none;border-top:1px solid #1e1e22;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                This message was sent to you by <strong style="color:#2E8B57;">Ovia AI</strong>, your RAIMZEAL coach.
                You can manage your email reminders in the app under <em>Profile → Reminders</em>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * POST /api/email/send
 * Body: { to: string, userName: string, type: "motivation" | "tip" | "custom", message?: string }
 * Sends a motivational or tip email to the specified address.
 */
emailRouter.post("/email/send", async (req, res) => {
  const { to, userName, type, message } = req.body as {
    to: string;
    userName: string;
    type: "motivation" | "tip" | "custom";
    message?: string;
  };

  if (!to || !userName) {
    res.status(400).json({ error: "to and userName are required." });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  const transporter = createTransporter();
  if (!transporter) {
    res.status(503).json({
      error: "Email service not configured. Please add SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.",
    });
    return;
  }

  let bodyText: string;
  let subject: string;

  if (type === "custom" && message) {
    bodyText = message;
    subject = "A message from Ovia AI — RAIMZEAL";
  } else if (type === "tip") {
    bodyText = pickMessage(FITNESS_TIPS, userName);
    subject = `Your fitness tip for today, ${userName.split(" ")[0]} 💪`;
  } else {
    bodyText = pickMessage(MOTIVATION_MESSAGES, userName);
    subject = `Keep going, ${userName.split(" ")[0]}! Your Ovia AI coach has a message for you`;
  }

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];

  try {
    await transporter.sendMail({
      from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`,
      to,
      subject,
      text: `${bodyText}\n\n— Your Ovia AI Coach via RAIMZEAL`,
      html: buildHtmlEmail(subject, bodyText, userName),
    });

    req.log.info({ to, type }, "Email sent successfully");
    res.json({ success: true, message: "Email sent successfully." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.warn({ error: errMsg }, "Email send failed");
    res.status(503).json({ error: errMsg });
  }
});

/**
 * POST /api/email/verify
 * Body: { to: string, userName: string }
 * Sends a 6-digit OTP verification code via email.
 */
emailRouter.post("/email/verify", async (req, res) => {
  const { to, userName } = req.body as { to: string; userName: string };

  if (!to || !userName) {
    res.status(400).json({ error: "to and userName are required." });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  const transporter = createTransporter();
  if (!transporter) {
    res.status(503).json({
      error: "Email service not configured.",
    });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const subject = "Your RAIMZEAL verification code";
  const bodyText = `Hi ${userName.split(" ")[0]},<br /><br />Your RAIMZEAL verification code is:<br /><br /><span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#2E8B57;">${otp}</span><br /><br />This code expires in 10 minutes. Do not share it with anyone.`;
  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];

  try {
    await transporter.sendMail({
      from: `"RAIMZEAL Security" <${fromAddress}>`,
      to,
      subject,
      text: `Your RAIMZEAL verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\n— RAIMZEAL Security`,
      html: buildHtmlEmail(subject, bodyText, userName),
    });

    req.log.info({ to }, "Verification OTP sent via email");
    res.json({ success: true, otp, message: "Verification code sent." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.warn({ error: errMsg }, "Email verify send failed");
    res.status(503).json({ error: errMsg });
  }
});

export default emailRouter;
