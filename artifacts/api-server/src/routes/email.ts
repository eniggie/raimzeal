import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { z } from "zod";
import { db, digestSubscribers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emailSendRateLimit, emailVerifyRateLimit, emailSubscribeRateLimit, emailUnsubscribeRateLimit, digestSendNowRateLimit } from "../lib/rateLimiter";
import { requireAuth } from "../middleware/auth";


const emailRouter = Router();

// ─── HMAC-signed unsubscribe tokens ────────────────────────────────────────────
// Prevents CSRF: anyone who knows an email address cannot unsubscribe it by
// crafting a GET request — the link must carry a valid token signed with a
// server secret known only to us.

// If neither secret env var is configured, fall back to a secret generated once at
// process boot rather than a hardcoded string — a hardcoded fallback would be
// visible in the built server bundle and would let anyone forge unsubscribe tokens.
const generatedUnsubscribeSecret = crypto.randomBytes(32).toString("hex");

function getUnsubscribeSecret(): string {
  return process.env["UNSUBSCRIBE_SECRET"] ?? process.env["INTERNAL_API_SECRET"] ?? generatedUnsubscribeSecret;
}

function makeUnsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", getUnsubscribeSecret()).update(email.toLowerCase().trim()).digest("hex");
}

function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = makeUnsubscribeToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function buildUnsubscribeUrl(email: string): string {
  const token = makeUnsubscribeToken(email);
  return `https://www.raimzeal.com/api/email/digest/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

// ─── HTML escaping ─────────────────────────────────────────────────────────────
// Must be applied to any user-supplied value before it is interpolated into HTML.

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Content pools — deterministic weekly rotation ────────────────────────────
// We pick by ISO week index so every subscriber gets the same tip that week.

function getWeekIndex(): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(Date.now() / msPerWeek);
}

function weeklyPick<T>(pool: T[]): T {
  return pool[getWeekIndex() % pool.length];
}

function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickMessage(pool: string[], userName: string): string {
  return pickRandom(pool).replace(/{name}/g, userName.split(" ")[0]);
}

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
  "Pain is temporary. Pride is permanent. Push through, {name}.",
  "You didn't come this far to only come this far, {name}. Keep rising.",
  "Success is the sum of small efforts repeated every day. You're doing it, {name}.",
  "The body achieves what the mind believes. Believe in your strength, {name}.",
  "Every sunrise is a new opportunity to get stronger. Seize today, {name}.",
  "Your health is your greatest asset — invest in it daily, {name}.",
  "Be proud of every small step. They all add up to something magnificent, {name}.",
  "Courage is starting before you're ready. You started — now keep going, {name}.",
  "Motivation gets you started; habit keeps you going. Build the habit, {name}.",
  "You are stronger than your excuses. Prove it today, {name}.",
];

const FITNESS_TIPS = [
  { tip: "Eating 1.6–2.2g of protein per kg of bodyweight daily optimises muscle protein synthesis.", link: "https://pubmed.ncbi.nlm.nih.gov/28642676/" },
  { tip: "Aim for 7–9 hours of sleep — poor sleep can increase appetite and cravings the following day.", link: "https://www.healthline.com/nutrition/sleep-and-weight-loss" },
  { tip: "Drinking 500ml of water before meals reduces calorie intake by approximately 13%.", link: "https://www.healthline.com/nutrition/drinking-water-helps-with-weight-loss" },
  { tip: "Progressive overload — adding 2.5–5kg to your lifts each week — is the #1 driver of muscle growth.", link: "https://www.healthline.com/health/progressive-overload" },
  { tip: "Zone 2 cardio (conversational pace) 3× per week powerfully builds your aerobic base and fat metabolism.", link: "https://www.healthline.com/health/fitness/zone-2-cardio" },
  { tip: "Magnesium glycinate 200–400mg before bed improves sleep quality and reduces muscle cramps.", link: "https://www.healthline.com/nutrition/magnesium-and-sleep" },
  { tip: "A 10-minute walk after meals reduces blood glucose spikes by up to 30%.", link: "https://www.mayoclinic.org/healthy-lifestyle/weight-loss/in-depth/exercise/art-20050999" },
  { tip: "Strength training 3× per week is as effective for fat loss as cardio — and preserves more muscle.", link: "https://www.healthline.com/health/fitness-exercise/strength-training-fat-loss" },
  { tip: "Creatine monohydrate 3–5g daily is the most research-backed performance supplement available.", link: "https://pubmed.ncbi.nlm.nih.gov/12945830/" },
  { tip: "150–300 minutes of moderate-intensity activity per week is the WHO's recommendation for optimal health.", link: "https://www.who.int/news-room/fact-sheets/detail/physical-activity" },
  { tip: "Eating a rainbow of vegetables provides a wide spectrum of micronutrients and antioxidants your body needs.", link: "https://www.healthline.com/nutrition/14-healthiest-vegetables-on-earth" },
  { tip: "Cold showers post-workout reduce muscle soreness (DOMS) and improve circulation.", link: "https://www.healthline.com/health/cold-shower-after-workout" },
  { tip: "Stretching for 10 minutes before bed improves flexibility and promotes deeper, more restorative sleep.", link: "https://www.healthline.com/health/benefits-of-stretching" },
  { tip: "Eating slowly and mindfully reduces overeating — it takes 20 minutes for your brain to register fullness.", link: "https://www.healthline.com/nutrition/mindful-eating-guide" },
  { tip: "Reducing ultra-processed food intake by just 20% significantly lowers your risk of metabolic disease.", link: "https://www.healthline.com/nutrition/9-ways-to-eat-less-processed-food" },
  { tip: "Hip mobility exercises 3× per week can eliminate lower-back pain and improve your squat depth significantly.", link: "https://www.healthline.com/health/hip-flexor-stretch" },
  { tip: "Intermittent fasting (16:8 window) can improve insulin sensitivity and support fat loss without muscle loss.", link: "https://www.healthline.com/nutrition/intermittent-fasting-guide" },
  { tip: "Foam rolling for 5–10 minutes post-workout reduces muscle tightness and accelerates recovery.", link: "https://www.healthline.com/health/foam-roller-benefits" },
  { tip: "Breathing through your nose during low-intensity cardio enhances oxygen efficiency and reduces perceived effort.", link: "https://www.healthline.com/health/nose-breathing" },
  { tip: "Eating fibre-rich foods (25–38g/day) feeds beneficial gut bacteria, improves digestion, and controls hunger.", link: "https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/fiber/art-20043983" },
  { tip: "Isometric exercises (planks, wall sits) build core stability without joint stress — great for injury prevention.", link: "https://www.healthline.com/health/isometric-exercises" },
  { tip: "Getting enough vitamin D through sunlight exposure and a balanced diet supports bone density and immune health.", link: "https://www.healthline.com/nutrition/vitamin-d-deficiency-symptoms" },
  { tip: "Compound lifts (squat, deadlift, bench, row) give the highest hormonal and metabolic return per workout.", link: "https://www.healthline.com/health/fitness-exercise/compound-exercises" },
  { tip: "Training to muscular failure is not required for hypertrophy — stopping 2–3 reps short is equally effective.", link: "https://pubmed.ncbi.nlm.nih.gov/32657971/" },
  { tip: "Eating 30g of protein within 30–60 minutes post-workout maximises muscle protein synthesis.", link: "https://www.healthline.com/nutrition/eat-after-workout" },
  { tip: "Spending time in nature (20+ minutes) measurably reduces cortisol and blood pressure.", link: "https://www.healthline.com/health/mind-body/green-exercise" },
  { tip: "Tracking your food intake even for just 2 weeks doubles your awareness of hidden calories and macros.", link: "https://www.healthline.com/nutrition/calorie-counting-apps" },
  { tip: "Sleep in a room below 19°C (66°F) — cooler temperatures trigger deeper sleep and better recovery.", link: "https://www.healthline.com/health/sleep/best-temperature-to-sleep" },
  { tip: "HIIT (High-Intensity Interval Training) 2× per week burns up to 30% more calories than steady-state cardio in less time.", link: "https://www.healthline.com/nutrition/benefits-of-hiit" },
  { tip: "Omega-3 fatty acids (EPA/DHA) from fish oil 1–2g/day reduce muscle inflammation and support cardiovascular health.", link: "https://www.healthline.com/nutrition/omega-3-guide" },
];

const HEALTH_INSIGHTS = [
  { insight: "Chronic stress elevates cortisol, which promotes abdominal fat storage and impairs muscle recovery. Manage stress daily.", link: "https://www.mayoclinic.org/healthy-lifestyle/stress-management/in-depth/stress/art-20046037" },
  { insight: "Gut health is your second brain. A diet rich in fibre and fermented foods supports mental clarity, immunity, and mood.", link: "https://www.healthline.com/nutrition/gut-microbiome-and-health" },
  { insight: "Sitting for more than 8 hours daily increases cardiovascular disease risk by 34%. Break it up every 30 minutes.", link: "https://www.mayoclinic.org/healthy-lifestyle/adult-health/expert-answers/sitting/faq-20058005" },
  { insight: "Dehydration of just 2% of body weight measurably impairs physical performance and cognitive function.", link: "https://www.healthline.com/health/dehydration-effects-on-body" },
  { insight: "Sunlight exposure in the morning regulates your circadian rhythm, boosts serotonin, and improves night-time melatonin production.", link: "https://www.healthline.com/health/morning-routine" },
  { insight: "Omega-3 fatty acids from oily fish reduce systemic inflammation and support brain, heart, and joint health.", link: "https://www.healthline.com/nutrition/17-health-benefits-of-omega-3" },
  { insight: "Laughing lowers cortisol, raises endorphins, and strengthens immunity. Find joy in your day, every single day.", link: "https://www.mayoclinic.org/healthy-lifestyle/stress-management/in-depth/stress-relief/art-20044456" },
  { insight: "Standing desks or movement breaks every 30 minutes can offset the metabolic harm of prolonged sitting.", link: "https://www.healthline.com/health/standing-vs-sitting" },
  { insight: "Social connection is as vital to long-term health as diet and exercise. Invest in your relationships actively.", link: "https://www.healthline.com/health/mental-health/social-support" },
  { insight: "Breathing exercises (4-7-8 or box breathing) activate the parasympathetic nervous system and lower anxiety within minutes.", link: "https://www.healthline.com/health/box-breathing" },
  { insight: "Regular sauna use (3–4× per week) reduces all-cause mortality risk by up to 40% and supports cardiovascular health.", link: "https://www.healthline.com/health/sauna-benefits" },
  { insight: "Blood sugar spikes and crashes drive hunger and energy crashes. Pairing carbs with protein and fat flattens the curve.", link: "https://www.healthline.com/health/blood-sugar-spike" },
  { insight: "Your heart rate variability (HRV) is one of the best indicators of recovery readiness. High HRV = well-recovered.", link: "https://www.healthline.com/health/heart-rate-variability" },
  { insight: "Chronic inflammation is the root driver of most modern diseases — cancer, diabetes, heart disease. Fight it with food and movement.", link: "https://www.healthline.com/nutrition/anti-inflammatory-diet-101" },
  { insight: "Consistent strength training and quality sleep are two of the most powerful habits for maintaining energy, vitality, and healthy ageing as you get older.", link: "https://www.healthline.com/health/fitness-exercise/benefits-of-exercise" },
  { insight: "Gratitude journalling for 5 minutes before bed has been shown to improve sleep quality and reduce anxiety.", link: "https://www.healthline.com/health/gratitude-journal" },
  { insight: "Your microbiome is unique as a fingerprint. Feed it diverse plant foods — aim for 30 different plants per week.", link: "https://www.healthline.com/health/gut-health" },
  { insight: "Even a single bout of moderate exercise boosts BDNF (brain growth factor), improving memory and focus for hours.", link: "https://www.healthline.com/health/exercise-and-brain-health" },
  { insight: "The 80/20 rule of nutrition: eating well 80% of the time gives you 100% of the long-term health benefits.", link: "https://www.healthline.com/nutrition/80-20-diet" },
  { insight: "Alcohol disrupts REM sleep architecture — even 1–2 drinks before bed reduces sleep quality by up to 39%.", link: "https://www.healthline.com/nutrition/alcohol-and-sleep" },
];

// Rotating trusted health & fitness resource websites (featured weekly)
const WEEKLY_RESOURCES = [
  { name: "Mayo Clinic — Exercise & Fitness", url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/basics/fitness-basics/hlv-20049447", desc: "Evidence-based fitness advice from one of the world's top medical centres." },
  { name: "Healthline — Nutrition Hub", url: "https://www.healthline.com/nutrition", desc: "Research-backed nutrition guides, meal plans and supplement reviews." },
  { name: "NIH — Health & Wellness", url: "https://www.nih.gov/health-information", desc: "National Institutes of Health — the gold standard of medical research." },
  { name: "PubMed — Fitness Research", url: "https://pubmed.ncbi.nlm.nih.gov/?term=exercise+fitness+nutrition", desc: "Search the world's largest database of peer-reviewed health studies." },
  { name: "WHO — Physical Activity Guidelines", url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity", desc: "Global guidelines for how much exercise you actually need." },
  { name: "WebMD — Fitness & Exercise", url: "https://www.webmd.com/fitness-exercise/default.htm", desc: "Comprehensive exercise guides, workout plans and injury prevention tips." },
  { name: "Harvard Health — Healthy Eating", url: "https://www.health.harvard.edu/topics/diet-and-weight-loss", desc: "Nutrition science from Harvard Medical School experts." },
  { name: "Examine.com — Supplement Research", url: "https://examine.com", desc: "Unbiased, independent supplement and nutrition research summaries." },
  { name: "Verywell Fit — Workouts & Nutrition", url: "https://www.verywellfit.com", desc: "Practical, expert-reviewed guides on every aspect of fitness and diet." },
  { name: "RAIMZEAL Community", url: "https://www.raimzeal.com", desc: "Your home for workouts, nutrition, AI coaching, and peer support." },
];

// ─── Email infrastructure ──────────────────────────────────────────────────────

function createTransporter() {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) return null;

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
            <td style="background:linear-gradient(135deg,#0a0a0b 0%,#111113 100%);padding:24px 32px;border-bottom:2px solid #2E8B57;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="https://raimzeal.com/favicon.png" alt="RAIMZEAL" style="width:52px;height:52px;border-radius:13px;display:block;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">RAIMZEAL</p>
                    <p style="margin:3px 0 0;font-size:12px;color:#2E8B57;font-weight:600;letter-spacing:0.3px;">Fitness · Food Therapy · Health Awareness · Free Forever</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
              <hr style="border:none;border-top:1px solid #1e1e22;margin:28px 0 20px;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <a href="https://www.raimzeal.com" style="display:inline-block;background:#2E8B57;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">Open RAIMZEAL App →</a>
                  </td>
                </tr>
              </table>
              <div style="background:#0d0d10;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;color:#C9A84C;text-transform:uppercase;">Books · Music · Courses · Coaching</p>
                <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;">by Dr. Ephraim Oviawe PHD, MBA, MTS, CST, AMA, DMIPRO, CSM, PMP (RAIMZY) · Founder &amp; CEO, ECONTEUR LLC</p>
                <a href="https://linktr.ee/Raimzy" style="display:inline-block;background:#8B31C7;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 20px;border-radius:6px;margin-right:6px;">linktr.ee/Raimzy</a>
                <a href="https://www.econteur.com" style="display:inline-block;background:#1e293b;color:#94a3b8;text-decoration:none;font-size:12px;font-weight:600;padding:8px 14px;border-radius:6px;">ECONTEUR LLC</a>
              </div>
              <hr style="border:none;border-top:1px solid #1e1e22;margin:20px 0;" />
              <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.8;text-align:center;">
                Sent by <strong style="color:#2E8B57;">Ovia AI</strong> · RAIMZEAL · Operated by ECONTEUR LLC<br />
                Manage preferences in the app under <em>Profile → Reminders</em>.<br />
                <a href="https://www.raimzeal.com" style="color:#6b7280;text-decoration:none;">raimzeal.com</a> &nbsp;·&nbsp;
                <a href="https://linktr.ee/Raimzy" style="color:#6b7280;text-decoration:none;">linktr.ee/Raimzy</a> &nbsp;·&nbsp;
                <a href="https://www.econteur.com" style="color:#6b7280;text-decoration:none;">econteur.com</a><br />
                <a href="https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00" style="color:#2E8B57;text-decoration:none;font-weight:600;">💚 Support the mission — a donation is never required</a>
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

function buildWeeklyDigestHtml(email: string, firstName: string, motivation: string, tipObj: { tip: string; link: string }, insightObj: { insight: string; link: string }, resource: { name: string; url: string; desc: string }, stats?: { streak?: number }): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const safeName = escapeHtml(firstName);
  const unsubscribeUrl = buildUnsubscribeUrl(email);

  const streakSection = (stats?.streak && stats.streak > 0)
    ? `<div style="background:#0c1520;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 20px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#f59e0b;text-transform:uppercase;">Your Streak This Week 🔥</p>
        <p style="margin:0;font-size:15px;color:#e8e8ec;">You're on a <strong style="color:#f59e0b;">${stats.streak}-day streak</strong> — keep it alive${stats.streak >= 7 ? " 💪 One full week, outstanding!" : "!"}</p>
      </div>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">${dateStr}</p>
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#ffffff;">Good morning, ${safeName}! 🌅</p>

    ${streakSection}

    <div style="background:#0d1f15;border-left:3px solid #2E8B57;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">Ovia AI — Weekly Motivation</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#e8e8ec;">${motivation}</p>
    </div>

    <div style="background:#1a1710;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#C9A84C;text-transform:uppercase;">Fitness Tip of the Week</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#e8e8ec;">${tipObj.tip}</p>
      <a href="${tipObj.link}" style="font-size:12px;color:#C9A84C;text-decoration:none;font-weight:600;">Read the research →</a>
    </div>

    <div style="background:#130e1c;border-left:3px solid #8B31C7;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#8B31C7;text-transform:uppercase;">Health Insight of the Week</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#e8e8ec;">${insightObj.insight}</p>
      <a href="${insightObj.link}" style="font-size:12px;color:#8B31C7;text-decoration:none;font-weight:600;">Learn more →</a>
    </div>

    <div style="background:#0f1520;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#3b82f6;text-transform:uppercase;">Resource of the Week</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#e8e8ec;">${resource.name}</p>
      <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;line-height:1.5;">${resource.desc}</p>
      <a href="${resource.url}" style="font-size:12px;color:#3b82f6;text-decoration:none;font-weight:600;">${resource.url.replace("https://", "")} →</a>
    </div>

    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#9ca3af;">
      Keep logging your workouts, meals and progress in RAIMZEAL — every entry brings you closer to your goals. Your Ovia AI coach is always here for you, 24/7.
    </p>

    <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
      You received this because you subscribed to the RAIMZEAL weekly digest.<br />
      <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe from this digest</a>
    </p>
  `;

  return buildHtmlEmail(`Your Weekly RAIMZEAL Digest — ${dateStr}`, bodyHtml);
}

function buildMidWeekHtml(email: string, firstName: string, motivation: string): string {
  const safeName = escapeHtml(firstName);
  const unsubscribeUrl = buildUnsubscribeUrl(email);

  const bodyHtml = `
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#ffffff;">Mid-week check-in, ${safeName}! 💪</p>

    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#9ca3af;">
      You're halfway through the week. Now is the perfect time to push hard and finish strong.
    </p>

    <div style="background:#0d1f15;border-left:3px solid #2E8B57;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">Ovia AI — Mid-Week Boost</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#e8e8ec;">${motivation}</p>
    </div>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#9ca3af;">
      Three things to do right now:<br />
      <span style="color:#e8e8ec;">💧</span> Drink a glass of water<br />
      <span style="color:#e8e8ec;">🏋️</span> Log your workout in RAIMZEAL<br />
      <span style="color:#e8e8ec;">🥗</span> Plan your next meal with intention<br />
    </p>

    <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
      You received this because you subscribed to the RAIMZEAL weekly digest.<br />
      <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe from this digest</a>
    </p>
  `;
  return buildHtmlEmail(`Mid-week motivation from Ovia AI, ${firstName}! 🔥`, bodyHtml);
}

// ─── Public send functions ─────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) throw new Error("SMTP not configured");

  const firstName = userName.split(" ")[0];
  const safeFirstName = escapeHtml(firstName);
  const motivation = pickRandom(MOTIVATION_MESSAGES).replace(/{name}/g, firstName);
  const tipObj = weeklyPick(FITNESS_TIPS);
  const resource = weeklyPick(WEEKLY_RESOURCES);

  const subject = `Welcome to RAIMZEAL, ${firstName}! Your journey starts now 🚀`;

  const bodyHtml = `
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#ffffff;">Welcome, ${safeFirstName}!</p>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#e8e8ec;">
      Your RAIMZEAL account is almost ready. Please <strong style="color:#2E8B57;">verify your email address</strong> via the confirmation email to unlock all features.
    </p>

    <div style="background:#0d1f15;border-left:3px solid #2E8B57;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">The Foundation Plan is free forever.</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#e8e8ec;">The Foundation Plan is free forever, built for fitness, food therapy, wellness, and healthcare support. We have turned down partnerships and commercial deals that would have compromised that mission. The Foundation Plan includes all core features at no cost. Donations help keep the staff and platform running for everyone — you are never required to pay.</p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">RAIMZEAL supports your wellness journey and does not replace a doctor, emergency care, or licensed medical diagnosis. Always consult a qualified healthcare professional for medical concerns.</p>
    </div>

    <div style="background:#0d1f15;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">Getting Started Checklist</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Verify your email address</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Log your first workout in the Workouts tab</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Track a meal using the Nutrition tab or barcode scanner</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Record your body measurements for progress tracking</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Chat with Ovia AI — your personal fitness coach</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Set up reminders so you never miss a session</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Share your progress card with the community</td></tr>
        <tr><td style="padding:5px 0;color:#e8e8ec;font-size:14px;">&#9989;&nbsp; Explore RAIMZY resources at linktr.ee/Raimzy</td></tr>
      </table>
    </div>

    <div style="background:#0d1f15;border-left:3px solid #2E8B57;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">A message from Ovia AI</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#e8e8ec;">${motivation}</p>
    </div>

    <div style="background:#1a1710;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#C9A84C;text-transform:uppercase;">Your First Fitness Tip</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#e8e8ec;">${tipObj.tip}</p>
      <a href="${tipObj.link}" style="font-size:12px;color:#C9A84C;text-decoration:none;font-weight:600;">Read the science</a>
    </div>

    <div style="background:#0f1520;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#3b82f6;text-transform:uppercase;">Recommended Health Resource</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#e8e8ec;">${resource.name}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">${resource.desc}</p>
      <a href="${resource.url}" style="font-size:12px;color:#3b82f6;text-decoration:none;font-weight:600;">${resource.url.replace("https://", "")}</a>
    </div>

    <div style="background:#1a0d0d;border-left:3px solid #e11d48;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#e11d48;text-transform:uppercase;">Support the mission (never required)</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#e8e8ec;">The Foundation Plan is free forever. If it has helped you, a voluntary donation keeps the staff and platform running for everyone. You are never required to give anything.</p>
      <a href="https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00" style="font-size:12px;color:#e11d48;text-decoration:none;font-weight:600;">💚 Donate — donate.stripe.com · Secure · Any amount helps</a>
    </div>

    <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;line-height:1.6;">
      You are now subscribed to our <strong style="color:#ffffff;">Saturday digest + Wednesday mid-week boost</strong> — twice a week, Ovia AI will send you fresh motivation, a fitness tip backed by research, a health insight, and a resource of the week.
    </p>
  `;

  const plainText = [
    `Welcome to RAIMZEAL, ${firstName}!`,
    "",
    "Please verify your email address by clicking the confirmation link.",
    "",
    "FREE FOREVER. NO EXCEPTIONS.",
    "RAIMZEAL exists to help people with fitness, food therapy, wellness, and healthcare support at zero cost.",
    "We have turned down partnerships that would have compromised that mission.",
    "You will never be required to pay to use this platform.",
    "",
    "GETTING STARTED:",
    "✅ Verify email · Log a workout · Track a meal · Body measurements",
    "✅ Chat with Ovia AI · Set reminders · Share progress",
    "✅ Explore RAIMZY resources: https://linktr.ee/Raimzy",
    "",
    "OVIA AI SAYS:", motivation, "",
    "FITNESS TIP:", tipObj.tip, `Learn more: ${tipObj.link}`, "",
    "RECOMMENDED RESOURCE:", `${resource.name} — ${resource.url}`,
    "",
    "SUPPORT THE MISSION (NEVER REQUIRED):",
    "If RAIMZEAL has helped you, a voluntary donation keeps the platform free for everyone.",
    "Donate: https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00",
    "",
    "Open the app: https://www.raimzeal.com",
    "RAIMZY resources: https://linktr.ee/Raimzy",
    "ECONTEUR LLC: https://www.econteur.com",
    "", "— Your Ovia AI Coach · RAIMZEAL",
  ].join("\n");

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
  await transporter.sendMail({
    from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`,
    to, subject, text: plainText,
    html: buildHtmlEmail(subject, bodyHtml),
  });
}

export async function sendCancellationEmail(
  to: string,
  userName: string,
  planName: string,
  periodEndDate: string,
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) throw new Error("SMTP not configured");

  const firstName = userName.split(" ")[0];
  const safeFirstName = escapeHtml(firstName);
  const safePlan = escapeHtml(planName);
  const safeDate = escapeHtml(periodEndDate);

  const subject = `Your RAIMZEAL ${planName} plan is set to cancel`;

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#ffffff;">Cancellation confirmed, ${safeFirstName}</p>

    <div style="background:#1a1208;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;color:#f59e0b;text-transform:uppercase;">What happens next</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#e8e8ec;">
        Your <strong style="color:#ffffff;">${safePlan} plan</strong> will remain fully active until
        <strong style="color:#f59e0b;">${safeDate}</strong>. After that, your account will automatically
        revert to the Foundation plan — which is <strong style="color:#2E8B57;">free forever</strong>.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#9ca3af;">
        All your workout history, nutrition logs, body measurements, and progress photos will be kept.
        Nothing is deleted.
      </p>
    </div>

    <div style="background:#0d1f15;border-left:3px solid #2E8B57;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;color:#2E8B57;text-transform:uppercase;">Changed your mind?</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#e8e8ec;">
        You can re-subscribe at any time before ${safeDate} to continue without interruption. Just head to the Membership page.
      </p>
      <a href="https://www.raimzeal.com/membership" style="display:inline-block;background:#2E8B57;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 22px;border-radius:8px;letter-spacing:0.3px;">Re-subscribe on RAIMZEAL →</a>
    </div>

    <p style="margin:0 0 20px;font-size:13px;line-height:1.65;color:#9ca3af;">
      Thank you for supporting the RAIMZEAL mission. Whether you are on Foundation or a paid plan,
      you are helping keep fitness, food therapy, and health support free for everyone.
    </p>
  `;

  const plainText = [
    `Cancellation confirmed, ${firstName}`,
    "",
    `Your ${planName} plan will remain active until ${periodEndDate}.`,
    "After that, your account will revert to the Foundation plan (free forever).",
    "",
    "Your workout history, nutrition logs, and progress data will all be kept.",
    "",
    "Changed your mind? Re-subscribe at: https://www.raimzeal.com/membership",
    "",
    "Thank you for supporting the RAIMZEAL mission.",
    "",
    "— Ovia AI · RAIMZEAL",
  ].join("\n");

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
  await transporter.sendMail({
    from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`,
    to, subject, text: plainText,
    html: buildHtmlEmail(subject, bodyHtml),
  });
}

export async function sendWeeklyDigest(
  to: string,
  userName: string,
  stats?: { streak?: number }
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) throw new Error("SMTP not configured");

  const firstName = userName.split(" ")[0];
  const motivation = weeklyPick(MOTIVATION_MESSAGES).replace(/{name}/g, firstName);
  const tipObj = weeklyPick(FITNESS_TIPS);
  const insightObj = weeklyPick(HEALTH_INSIGHTS);
  const resource = weeklyPick(WEEKLY_RESOURCES);

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const subject = `Good morning ${firstName}! Your weekly RAIMZEAL digest 💪`;

  const plainText = [
    `Good morning ${firstName}! — ${dateStr}`, "",
    "MOTIVATION:", motivation, "",
    "FITNESS TIP:", tipObj.tip, `Research: ${tipObj.link}`, "",
    "HEALTH INSIGHT:", insightObj.insight, `Learn more: ${insightObj.link}`, "",
    "RESOURCE OF THE WEEK:", `${resource.name}`, resource.desc, resource.url, "",
    "Open the app: https://www.raimzeal.com",
    "RAIMZY resources: https://linktr.ee/Raimzy",
    "",
    `To unsubscribe: ${buildUnsubscribeUrl(to)}`,
    "", "— Your Ovia AI Coach · RAIMZEAL",
  ].join("\n");

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
  await transporter.sendMail({
    from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`,
    to, subject, text: plainText,
    html: buildWeeklyDigestHtml(to, firstName, motivation, tipObj, insightObj, resource, stats),
  });
}

export async function sendMidWeekMotivation(to: string, userName: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) throw new Error("SMTP not configured");

  const firstName = userName.split(" ")[0];
  const motivation = weeklyPick(MOTIVATION_MESSAGES.slice(10)).replace(/{name}/g, firstName);
  const subject = `Mid-week boost from Ovia AI, ${firstName}! 🔥`;

  const plainText = [
    `Mid-week check-in, ${firstName}!`, "",
    "OVIA AI SAYS:", motivation, "",
    "Three things to do right now:",
    "💧 Drink a glass of water",
    "🏋️ Log your workout in RAIMZEAL",
    "🥗 Plan your next meal with intention",
    "",
    "Open the app: https://www.raimzeal.com",
    "RAIMZY resources: https://linktr.ee/Raimzy",
    "",
    `To unsubscribe: ${buildUnsubscribeUrl(to)}`,
    "", "— Your Ovia AI Coach · RAIMZEAL",
  ].join("\n");

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
  await transporter.sendMail({
    from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`,
    to, subject, text: plainText,
    html: buildMidWeekHtml(to, firstName, motivation),
  });
}

// ─── Routes ────────────────────────────────────────────────────────────────────

const EmailSendSchema = z.object({
  to: z.string().email("Invalid email address."),
  userName: z.string().min(1).max(100),
  type: z.enum(["motivation", "tip", "custom", "weekly", "welcome", "midweek"]),
  message: z.string().max(2000, "Custom message too long — max 2000 characters.").optional(),
});

emailRouter.post("/email/send", requireAuth, emailSendRateLimit, async (req, res) => {
  const parse = EmailSendSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { to, userName, type, message } = parse.data;

  if (type === "weekly") {
    try { await sendWeeklyDigest(to, userName); req.log.info({ to }, "Weekly digest sent"); res.json({ success: true, message: "Weekly digest sent." }); }
    catch (err) { req.log.error({ err }, "POST /email/send weekly digest error"); res.status(503).json({ error: "Failed to send email. Please try again later." }); }
    return;
  }
  if (type === "welcome") {
    try { await sendWelcomeEmail(to, userName); req.log.info({ to }, "Welcome email sent"); res.json({ success: true, message: "Welcome email sent." }); }
    catch (err) { req.log.error({ err }, "POST /email/send welcome email error"); res.status(503).json({ error: "Failed to send email. Please try again later." }); }
    return;
  }
  if (type === "midweek") {
    try { await sendMidWeekMotivation(to, userName); req.log.info({ to }, "Mid-week email sent"); res.json({ success: true, message: "Mid-week motivation sent." }); }
    catch (err) { req.log.error({ err }, "POST /email/send midweek email error"); res.status(503).json({ error: "Failed to send email. Please try again later." }); }
    return;
  }

  const transporter = createTransporter();
  if (!transporter) { res.status(503).json({ error: "Email service not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM env vars." }); return; }

  let bodyText: string;
  let subject: string;

  if (type === "custom" && message) {
    bodyText = message;
    subject = "A message from Ovia AI — RAIMZEAL";
  } else if (type === "tip") {
    const tipObj = weeklyPick(FITNESS_TIPS);
    bodyText = tipObj.tip + `\n\nRead more: ${tipObj.link}`;
    subject = `Your fitness tip this week, ${userName.split(" ")[0]} 💪`;
  } else {
    bodyText = pickMessage(MOTIVATION_MESSAGES, userName);
    subject = `Keep going, ${userName.split(" ")[0]}! Ovia AI has a message for you`;
  }

  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
  try {
    await transporter.sendMail({
      from: `"Ovia AI — RAIMZEAL" <${fromAddress}>`, to, subject,
      text: `${bodyText}\n\nOpen the app: https://www.raimzeal.com\nRAIMZY resources: https://linktr.ee/Raimzy\n\n— Your Ovia AI Coach · RAIMZEAL`,
      html: buildSimpleHtmlEmail(subject, bodyText.replace(/\n/g, "<br />")),
    });
    req.log.info({ to, type }, "Email sent"); res.json({ success: true, message: "Email sent." });
  } catch (err) {
    req.log.error({ err }, "POST /email/send error");
    res.status(503).json({ error: "Failed to send email. Please try again later." });
  }
});

emailRouter.post("/email/verify", requireAuth, emailVerifyRateLimit, async (req, res) => {
  const { to, userName } = req.body as { to: string; userName: string };
  if (!to || !userName) { res.status(400).json({ error: "to and userName are required." }); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { res.status(400).json({ error: "Invalid email address." }); return; }

  const transporter = createTransporter();
  if (!transporter) { res.status(503).json({ error: "Email service not configured." }); return; }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const subject = "Your RAIMZEAL verification code";
  const fromAddress = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
  const firstName = userName.split(" ")[0];
  const safeFirstName = escapeHtml(firstName);

  try {
    await transporter.sendMail({
      from: `"RAIMZEAL Security" <${fromAddress}>`, to, subject,
      text: `Your RAIMZEAL verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\n— RAIMZEAL Security`,
      html: buildSimpleHtmlEmail(subject, `Hi ${safeFirstName},<br /><br />Your RAIMZEAL verification code is:<br /><br /><span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#2E8B57;">${otp}</span><br /><br />This code expires in 10 minutes. Do not share it with anyone.`),
    });
    req.log.info({ to }, "Verification OTP sent");
    res.json({ success: true, message: "Verification code sent." });
  } catch (err) {
    req.log.error({ err }, "POST /email/verify error");
    res.status(503).json({ error: "Failed to send verification email. Please try again later." });
  }
});

emailRouter.post("/email/digest/subscribe", requireAuth, emailSubscribeRateLimit, async (req, res) => {
  const { email, userName } = req.body as { email: string; userName: string };
  if (!email || !userName) { res.status(400).json({ error: "email and userName are required." }); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "Invalid email address." }); return; }

  const userId = req.userId as string;

  try {
    await db.insert(digestSubscribers).values({ email, userName, userId, active: true })
      .onConflictDoUpdate({ target: digestSubscribers.email, set: { userName, userId, active: true } });
    req.log.info({ email }, "Digest subscriber added");
    res.json({ success: true, message: "Subscribed to weekly digest." });
  } catch (err) {
    req.log.error({ err }, "POST /email/digest/subscribe error");
    res.status(500).json({ error: "Could not subscribe to digest. Please try again." });
  }
});

emailRouter.post("/email/digest/unsubscribe", requireAuth, emailUnsubscribeRateLimit, async (req, res) => {
  const { email } = req.body as { email: string };
  if (!email) { res.status(400).json({ error: "email is required." }); return; }
  try {
    await db.update(digestSubscribers).set({ active: false }).where(eq(digestSubscribers.email, email));
    req.log.info({ email }, "Digest subscriber deactivated");
    res.json({ success: true, message: "Unsubscribed from weekly digest." });
  } catch (err) {
    req.log.error({ err }, "POST /email/digest/unsubscribe error");
    res.status(500).json({ error: "Could not unsubscribe. Please try again." });
  }
});

// One-click unsubscribe via email link — no auth required, but HMAC token required
emailRouter.get("/email/digest/unsubscribe", emailUnsubscribeRateLimit, async (req, res) => {
  const email = typeof req.query["email"] === "string" ? req.query["email"].trim() : "";
  const token = typeof req.query["token"] === "string" ? req.query["token"].trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Unsubscribe — RAIMZEAL</title></head><body style="margin:0;padding:40px;background:#0a0a0b;font-family:sans-serif;color:#e8e8ec;text-align:center;"><p style="font-size:16px;color:#e11d48;">Invalid or missing email address.</p></body></html>`);
    return;
  }
  if (!token || !verifyUnsubscribeToken(email, token)) {
    res.status(403).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Unsubscribe — RAIMZEAL</title></head><body style="margin:0;padding:40px;background:#0a0a0b;font-family:sans-serif;color:#e8e8ec;text-align:center;"><p style="font-size:16px;color:#e11d48;">This unsubscribe link is invalid or has expired. Please use the link from your most recent RAIMZEAL email.</p></body></html>`);
    return;
  }
  try {
    await db.update(digestSubscribers).set({ active: false }).where(eq(digestSubscribers.email, email));
    req.log.info({ email }, "Digest subscriber deactivated via one-click link");
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Unsubscribed — RAIMZEAL</title></head><body style="margin:0;padding:60px 20px;background:#0a0a0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e8e8ec;text-align:center;"><p style="font-size:28px;margin-bottom:12px;">✅</p><p style="font-size:20px;font-weight:700;color:#ffffff;margin-bottom:8px;">You've been unsubscribed.</p><p style="font-size:14px;color:#9ca3af;margin-bottom:32px;">${escapeHtml(email)} has been removed from the RAIMZEAL weekly digest.</p><a href="https://www.raimzeal.com" style="display:inline-block;background:#2E8B57;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;">Back to RAIMZEAL</a></body></html>`);
  } catch (err) {
    req.log.error({ email, err }, "Failed to unsubscribe via one-click link");
    res.status(500).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Error — RAIMZEAL</title></head><body style="margin:0;padding:40px;background:#0a0a0b;font-family:sans-serif;color:#e8e8ec;text-align:center;"><p style="font-size:16px;color:#e11d48;">Something went wrong. Please try again or contact support@raimzeal.com.</p></body></html>`);
  }
});

emailRouter.post("/email/digest/send-now", digestSendNowRateLimit, async (req, res) => {
  // This endpoint triggers a mass email to all subscribers — require an internal
  // secret so it cannot be called by anyone outside of automated server processes.
  const providedSecret = req.headers["x-internal-secret"];
  const expectedSecret = process.env["INTERNAL_API_SECRET"];
  if (!expectedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({ error: "Unauthorized: valid x-internal-secret header required." });
    return;
  }

  try {
    const subscribers = await db.select().from(digestSubscribers).where(eq(digestSubscribers.active, true));
    if (subscribers.length === 0) { res.json({ success: true, sent: 0, message: "No active subscribers." }); return; }

    let sent = 0; let failed = 0; const errors: string[] = [];
    for (const sub of subscribers) {
      try { await sendWeeklyDigest(sub.email, sub.userName); sent++; }
      catch (err) { failed++; errors.push(`${sub.email}: ${err instanceof Error ? err.message : "unknown"}`); }
    }
    req.log.info({ sent, failed }, "Manual digest send complete");
    res.json({ success: true, sent, failed, total: subscribers.length, errors });
  } catch (err) {
    req.log.error({ err }, "POST /email/digest/send-now error");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default emailRouter;
