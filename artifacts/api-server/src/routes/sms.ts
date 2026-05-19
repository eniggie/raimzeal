import { Router } from "express";

const smsRouter = Router();

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

async function sendTwilioSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const fromNumber = process.env["TWILIO_FROM_NUMBER"];

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "SMS service not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables." };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams({
    From: fromNumber,
    To: to,
    Body: body,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { message?: string };
      return { success: false, error: errorData.message ?? `Twilio error ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * POST /api/sms/send
 * Body: { to: string, userName: string, type: "motivation" | "tip" | "custom", message?: string }
 * Sends a motivational or tip SMS to the specified phone number via Twilio.
 */
smsRouter.post("/sms/send", async (req, res) => {
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

  const cleanPhone = to.replace(/\s+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
    res.status(400).json({
      error: "Phone number must be in E.164 format, e.g. +447911123456 or +14155551234.",
    });
    return;
  }

  let body: string;
  if (type === "custom" && message) {
    body = message.slice(0, 160);
  } else if (type === "tip") {
    body = pickMessage(FITNESS_TIPS, userName);
  } else {
    body = pickMessage(MOTIVATION_MESSAGES, userName);
  }

  const suffix = "\n\n— Your Ovia AI Coach via RAIMZEAL";
  body = body + suffix;

  const result = await sendTwilioSms(cleanPhone, body);

  if (!result.success) {
    req.log.warn({ error: result.error }, "SMS send failed");
    res.status(503).json({ error: result.error });
    return;
  }

  req.log.info({ to: cleanPhone, type }, "SMS sent successfully");
  res.json({ success: true, message: "SMS sent successfully." });
});

/**
 * POST /api/sms/verify
 * Body: { to: string, userName: string }
 * Sends a 6-digit OTP verification code via SMS.
 */
smsRouter.post("/sms/verify", async (req, res) => {
  const { to, userName } = req.body as { to: string; userName: string };

  if (!to || !userName) {
    res.status(400).json({ error: "to and userName are required." });
    return;
  }

  const cleanPhone = to.replace(/\s+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
    res.status(400).json({ error: "Phone number must be in E.164 format." });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const body = `RAIMZEAL: Your verification code is ${otp}. This code expires in 10 minutes. Do not share it with anyone.\n\n— RAIMZEAL Security`;

  const result = await sendTwilioSms(cleanPhone, body);

  if (!result.success) {
    req.log.warn({ error: result.error }, "OTP SMS send failed");
    res.status(503).json({ error: result.error });
    return;
  }

  req.log.info({ to: cleanPhone }, "Verification OTP sent");
  res.json({ success: true, otp, message: "Verification code sent." });
});

export default smsRouter;
