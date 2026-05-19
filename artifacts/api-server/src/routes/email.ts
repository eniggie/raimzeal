import { Router } from "express";
import nodemailer from "nodemailer";
import { db, digestSubscribers } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  "Believe in the process. Your dedication today is your transformation tomorrow, {name}.",
  "Every rep, every step, every healthy bite counts. You are winning, {name}!",
  "Health is not a destination — it's a way of living. Keep living it boldly, {name}.",
  "Your commitment to wellness inspires everyone around you, {name}. Never stop.",
  "Difficult roads lead to beautiful destinations. Stay the course, {name}.",
];

const FITNESS_TIPS = [
  "Tip: Eating 1.6–2.2g of protein per kg of bodyweight daily optimises muscle protein synthesis.",
  "Tip: Aim for 7–9 hours of sleep — poor sleep increases hunger hormones by up to 24%.",
  "Tip: Drinking 500ml of water before meals reduces calorie intake by approximately 13%.",
  "Tip: Progressive overload — adding 2.5–5kg to your lifts each week — is the #1 driver of muscle growth.",
  "Tip: Zone 2 cardio (conversational pace) 3× per week powerfully builds your aerobic base.",
  "Tip: Magnesium glycinate 200–400mg before bed improves sleep quality and reduces muscle cramps.",
  "Tip: A 10-minute walk after meals reduces blood glucose spikes by up to 30%.",
  "Tip: Strength training 3× per week is as effective for fat loss as cardio — and preserves more muscle.",
  "Tip: Creatine monohydrate 3–5g daily is the most research-backed performance supplement. It works.",
  "Tip: 150–300 minutes of moderate-intensity activity per week is the WHO's recommendation for optimal health.",
  "Tip: Eating a rainbow of vegetables ensures you get a wide spectrum of micronutrients and antioxidants.",
  "Tip: Cold showers post-workout reduce muscle soreness and improve circulation.",
  "Tip: Stretching for 10 minutes before bed improves flexibility and promotes deeper sleep.",
  "Tip: Eating slowly and mindfully reduces overeating — it takes 20 minutes for your brain to register fullness.",
  "Tip: Reducing ultra-processed food intake by just 20% significantly lowers your risk of metabolic disease.",
];

const HEALTH_INSIGHTS = [
  "Health insight: Chronic stress elevates cortisol, which promotes fat storage around the abdomen. Manage stress daily.",
  "Health insight: Gut health is your second brain. A diet rich in fibre and fermented foods supports mental clarity and immunity.",
  "Health insight: Sitting for more than 8 hours daily increases cardiovascular disease risk by 34%. Break it up with walks.",
  "Health insight: Dehydration of just 2% of body weight measurably impairs physical and cognitive performance.",
  "Health insight: Sunlight exposure in the morning regulates your circadian rhythm and boosts serotonin naturally.",
  "Health insight: Omega-3 fatty acids from oily fish reduce inflammation and support brain, heart, and joint health.",
  "Health insight: Laughing lowers cortisol, raises endorphins, and strengthens immunity. Find joy in your day, every day.",
  "Health insight: Standing desks or movement breaks every 30 minutes can offset the metabolic harm of prolonged sitting.",
  "Health insight: Social connection is as vital to health as diet and exercise. Invest in your relationships.",
  "Health insight: Breathing exercises (4-7-8 or box breathing) activate the parasympathetic system and lower anxiety within minutes.",
];

function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickMessage(pool: string[], userName: string): string {
  return pickRandom(pool).replace(/{name}/g, userName.split(" ")[0]);
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

function buildHtmlEmail(subject: string, bodyHtml: string): string {
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
            <td style="background:linear-gradient(135deg,#1a5c38 0%,#2E8B57 60%,#3da86a 100%);padding:28px 32px;">
              <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">RAIMZEAL</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.80);font-weight:500;">Your AI-powered fitness &amp; wellness coach</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
              <hr style="border:none;border-top:1px solid #1e1e22;margin:28px 0 20px;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <a href="https://www.raimzeal.com" style="display:inline-block;background:#2E8B57;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">Open RAIMZEAL App</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
                For inspiring music and books by our CEO/MD<br />
                <strong style="color:#C9A84C;">Dr. Ephraim Oviawe</strong>, visit<br />
                <a href="https://linktr.ee/Raimzy" style="color:#8B31C7;text-decoration:none;font-weight:600;">linktr.ee/Raimzy</a>
              </p>
              <hr style="border:none;border-top:1px solid #1e1e22;margin:20px 0;" />
              <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.5;text-align:center;">
                This weekly digest is sent by <strong style="color:#2E8B57;">Ovia AI</strong>, your RAIMZEAL coach.<br />
                Manage your preferences in the app under <em>Profile → Reminders</em>.<br />
                <a href="https://www.raimzeal.com" style="color:#6b7280;text-decoration:none;">www.raimzeal.com</a>
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

function buildSimpleHtmlEmail(subject: string, bodyText: string): string {
  const bodyHtml = `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e8e8ec;">${bodyText}</p>`;
  return buildHtmlEmail(subject, bodyHtml);
}

function buildWeeklyDigestHtml(firstName: string, motivation: string, tip: string, insight: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">${dateStr}</p>
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#ffffff;">Good morning, ${firstName}! 🌅</p>

    <div style="background:#0d1f15;border-left:3px solid #2E8B57;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">Ovia AI — Weekly Motivation</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#e8e8ec;">${motivation}</p>
    </div>

    <div style="background:#1a1710;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#C9A84C;text-transform:uppercase;">Fitness Tip of the Week</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#e8e8ec;">${tip}</p>
    </div>

    <div style="background:#130e1c;border-left:3px solid #8B31C7;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#8B31C7;text-transform:uppercase;">Health Insight</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#e8e8ec;">${insight}</p>
    </div>

    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#9ca3af;">
      Keep logging your workouts, meals and progress in RAIMZEAL — every entry brings you closer to your goals. Your Ovia AI coach is always here for you.
    </p>
  `;

  return buildHtmlEmail(`Your Weekly RAIMZEAL Digest — ${dateStr}`, bodyHtml);
}

export async function sendWeeklyDigest(to: string, userName: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error("SMTP not configured");
  }

  const firstName = userName.split(" ")[0];
  const motivation = pickRandom(MOTIVATION_MESSAGES).replace(/{name}/g, firstName);
  const tip = pickRandom(FITNESS_TIPS);
  const insight = pickRandom(HEALTH_INSIGHTS);

  const subject = `Good morning ${firstName}! Your weekly RAIMZEAL digest from Ovia AI 💪`;
  const plainText = [
    `Good morning ${firstName}!`,
    "",
    "MOTIVATION:",
    motivation,
    "",
    "FITNESS TIP:",
    tip,
    "",
    "HEALTH INSIGHT:",
    insight,
    "",
    "Visit RAIMZEAL: https://www.raimzeal.com",
    "",
    "For music & books by our CEO/MD Dr. Ephraim Oviawe: https://linktr.ee/Raimzy",
    "",
    "— Your Ovia AI Coach via RAIMZEAL",
  ].join("\n");

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];

  await transporter.sendMail({
    from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`,
    to,
    subject,
    text: plainText,
    html: buildWeeklyDigestHtml(firstName, motivation, tip, insight),
  });
}

/**
 * POST /api/email/send
 */
emailRouter.post("/email/send", async (req, res) => {
  const { to, userName, type, message } = req.body as {
    to: string;
    userName: string;
    type: "motivation" | "tip" | "custom" | "weekly";
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

  if (type === "weekly") {
    try {
      await sendWeeklyDigest(to, userName);
      req.log.info({ to }, "Weekly digest sent");
      res.json({ success: true, message: "Weekly digest sent successfully." });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      req.log.warn({ error: errMsg }, "Weekly digest send failed");
      res.status(503).json({ error: errMsg });
    }
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
      text: `${bodyText}\n\nVisit RAIMZEAL: https://www.raimzeal.com\n\n— Your Ovia AI Coach via RAIMZEAL`,
      html: buildSimpleHtmlEmail(subject, bodyText),
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
    res.status(503).json({ error: "Email service not configured." });
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
      html: buildSimpleHtmlEmail(subject, bodyText),
    });

    req.log.info({ to }, "Verification OTP sent via email");
    res.json({ success: true, otp, message: "Verification code sent." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.warn({ error: errMsg }, "Email verify send failed");
    res.status(503).json({ error: errMsg });
  }
});

/**
 * POST /api/email/digest/subscribe
 * Body: { email, userName }
 */
emailRouter.post("/email/digest/subscribe", async (req, res) => {
  const { email, userName } = req.body as { email: string; userName: string };

  if (!email || !userName) {
    res.status(400).json({ error: "email and userName are required." });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  try {
    await db
      .insert(digestSubscribers)
      .values({ email, userName, active: true })
      .onConflictDoUpdate({
        target: digestSubscribers.email,
        set: { userName, active: true },
      });

    req.log.info({ email }, "Digest subscriber added/reactivated");
    res.json({ success: true, message: "Subscribed to weekly digest." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.warn({ error: errMsg }, "Digest subscribe failed");
    res.status(500).json({ error: errMsg });
  }
});

/**
 * POST /api/email/digest/unsubscribe
 * Body: { email }
 */
emailRouter.post("/email/digest/unsubscribe", async (req, res) => {
  const { email } = req.body as { email: string };

  if (!email) {
    res.status(400).json({ error: "email is required." });
    return;
  }

  try {
    await db
      .update(digestSubscribers)
      .set({ active: false })
      .where(eq(digestSubscribers.email, email));

    req.log.info({ email }, "Digest subscriber deactivated");
    res.json({ success: true, message: "Unsubscribed from weekly digest." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.warn({ error: errMsg }, "Digest unsubscribe failed");
    res.status(500).json({ error: errMsg });
  }
});

/**
 * POST /api/email/digest/send-now
 * Manually trigger the weekly digest to all active subscribers (admin/test use).
 */
emailRouter.post("/email/digest/send-now", async (req, res) => {
  try {
    const subscribers = await db
      .select()
      .from(digestSubscribers)
      .where(eq(digestSubscribers.active, true));

    if (subscribers.length === 0) {
      res.json({ success: true, sent: 0, message: "No active subscribers." });
      return;
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subscribers) {
      try {
        await sendWeeklyDigest(sub.email, sub.userName);
        sent++;
      } catch (err) {
        failed++;
        errors.push(`${sub.email}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    req.log.info({ sent, failed }, "Manual digest send complete");
    res.json({ success: true, sent, failed, total: subscribers.length, errors });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ error: errMsg }, "Manual digest send crashed");
    res.status(500).json({ error: errMsg });
  }
});

export default emailRouter;
