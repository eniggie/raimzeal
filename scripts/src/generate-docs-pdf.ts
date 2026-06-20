import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = require("pdfkit") as any;
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(process.cwd(), ".local", "outputs");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Brand ────────────────────────────────────────────────────────────────────
const C = {
  bg:      "#0D0D0D",
  surface: "#1A1A1A",
  gold:    "#C8A84B",
  green:   "#2D8C4E",
  white:   "#F0EDE8",
  muted:   "#888888",
  border:  "#2A2A2A",
};

// ─── PDF helpers ──────────────────────────────────────────────────────────────
function newDoc(title: string): any {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: {
      Title: `RAIMZEAL – ${title}`,
      Author: "Dr. Ephraim Oviawe – ECONTEUR LLC",
      Subject: title,
      Keywords: "RAIMZEAL health wellness free non-profit",
    },
    autoFirstPage: false,
  });
  return doc;
}

function W(doc: any) { return doc.page.width; }
function H(doc: any) { return doc.page.height; }
function ML(doc: any) { return doc.page.margins.left; }
function MR(doc: any) { return doc.page.margins.right; }
function TW(doc: any) { return W(doc) - ML(doc) - MR(doc); }

function bgFill(doc: any) {
  doc.rect(0, 0, W(doc), H(doc)).fill(C.bg);
}

function topBar(doc: any) {
  doc.rect(0, 0, W(doc), 4).fill(C.gold);
}

function footer(doc: any, pageLabel: string, pageNum: number) {
  const y = H(doc) - 36;
  doc.rect(0, y - 4, W(doc), 1).fill(C.border);
  doc.fillColor(C.muted).fontSize(7).font("Helvetica")
    .text(pageLabel, ML(doc), y, { width: TW(doc) - 60 })
    .text(String(pageNum), ML(doc), y, { width: TW(doc), align: "right" });
}

function titlePage(doc: any, guideTitle: string, subtitle: string) {
  doc.addPage();
  bgFill(doc);
  // Left gold accent bar
  doc.rect(0, 0, 6, H(doc)).fill(C.gold);
  // RAIMZEAL wordmark
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(60)
    .text("RAIMZEAL", ML(doc) + 10, 130, { width: TW(doc) });
  // Guide title
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(28)
    .text(guideTitle, ML(doc) + 10, 210, { width: TW(doc) });
  // Subtitle
  doc.fillColor(C.muted).font("Helvetica").fontSize(13)
    .text(subtitle, ML(doc) + 10, 260, { width: TW(doc), lineGap: 4 });
  // Divider
  doc.rect(ML(doc) + 10, 330, 120, 2).fill(C.green);
  // Meta
  doc.fillColor(C.muted).font("Helvetica").fontSize(10)
    .text("ECONTEUR LLC  ·  Dr. Ephraim Oviawe, Founder", ML(doc) + 10, 345)
    .text("RAIMZEAL v1.3.0  ·  June 2026  ·  raimzeal.com", ML(doc) + 10, 360);
  // FREE badge
  doc.rect(ML(doc) + 10, 395, 180, 24).fill(C.surface);
  doc.fillColor(C.green).font("Helvetica-Bold").fontSize(10)
    .text("FREE · OPEN · EVIDENCE-BASED", ML(doc) + 18, 401);
}

function sectionHeading(doc: any, num: string, title: string, pageNum: number) {
  doc.addPage();
  bgFill(doc);
  topBar(doc);
  // Number bubble
  doc.circle(ML(doc) + 22, 100, 22).fill(C.gold);
  doc.fillColor(C.bg).font("Helvetica-Bold").fontSize(16)
    .text(num, ML(doc), 92, { width: 44, align: "center" });
  // Section title
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(32)
    .text(title, ML(doc), 136, { width: TW(doc) });
  doc.rect(ML(doc), 185, 160, 3).fill(C.green);
  footer(doc, "RAIMZEAL Documentation Suite – ECONTEUR LLC", pageNum);
}

function contentPage(
  doc: any,
  heading: string,
  items: { label: string; detail?: string }[],
  pageNum: number
) {
  doc.addPage();
  bgFill(doc);
  topBar(doc);
  // Heading
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(16)
    .text(heading, ML(doc), 20, { width: TW(doc) });
  doc.rect(ML(doc), 42, TW(doc), 1).fill(C.border);

  let y = 52;
  for (const item of items) {
    if (y > H(doc) - 80) break; // safety guard
    // Bullet square
    doc.rect(ML(doc), y + 4, 7, 7).fill(C.gold);
    // Label
    const labelHeight = doc.heightOfString(item.label, { width: TW(doc) - 20, font: "Helvetica-Bold", size: 11 });
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11)
      .text(item.label, ML(doc) + 16, y, { width: TW(doc) - 16 });
    y += labelHeight + 2;
    if (item.detail) {
      const detailHeight = doc.heightOfString(item.detail, { width: TW(doc) - 24, font: "Helvetica", size: 9.5 });
      doc.fillColor(C.muted).font("Helvetica").fontSize(9.5)
        .text(item.detail, ML(doc) + 24, y, { width: TW(doc) - 24, lineGap: 1.5 });
      y += detailHeight + 4;
    }
    y += 7;
  }
  footer(doc, "RAIMZEAL Documentation Suite – ECONTEUR LLC", pageNum);
}

function tablePage(
  doc: any,
  heading: string,
  headers: string[],
  rows: string[][],
  pageNum: number,
  colWidths?: number[]
) {
  doc.addPage();
  bgFill(doc);
  topBar(doc);
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(16)
    .text(heading, ML(doc), 20, { width: TW(doc) });
  doc.rect(ML(doc), 42, TW(doc), 1).fill(C.border);

  const tw = TW(doc);
  const cw = colWidths ?? headers.map(() => tw / headers.length);
  const rowH = 22;
  let y = 52;

  // Header row
  let x = ML(doc);
  doc.rect(ML(doc), y, tw, rowH).fill(C.surface);
  headers.forEach((h, i) => {
    doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(9)
      .text(h, x + 4, y + 6, { width: cw[i] - 8, ellipsis: true });
    x += cw[i];
  });
  y += rowH;

  // Data rows
  rows.forEach((row, ri) => {
    doc.rect(ML(doc), y, tw, rowH).fill(ri % 2 === 0 ? C.bg : C.surface);
    doc.rect(ML(doc), y + rowH - 1, tw, 1).fill(C.border);
    x = ML(doc);
    row.forEach((cell, i) => {
      doc.fillColor(i === 0 ? C.white : C.muted).font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
        .text(cell, x + 4, y + 6, { width: cw[i] - 8, ellipsis: true });
      x += cw[i];
    });
    y += rowH;
  });

  footer(doc, "RAIMZEAL Documentation Suite – ECONTEUR LLC", pageNum);
}

function closingPage(doc: any, guideTitle: string, pageNum: number) {
  doc.addPage();
  bgFill(doc);
  doc.rect(0, 0, 6, H(doc)).fill(C.gold);
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(52)
    .text("RAIMZEAL", ML(doc) + 10, 180);
  doc.fillColor(C.white).font("Helvetica").fontSize(22)
    .text(`End of ${guideTitle}`, ML(doc) + 10, 260);
  doc.fillColor(C.green).font("Helvetica-Bold").fontSize(13)
    .text("Free · Open · Evidence-Based Healthcare for Every Human", ML(doc) + 10, 300);
  doc.rect(ML(doc) + 10, 332, 200, 2).fill(C.border);
  doc.fillColor(C.muted).font("Helvetica").fontSize(9)
    .text("raimzeal.com  ·  support@raimzeal.com  ·  ECONTEUR LLC  ·  June 2026", ML(doc) + 10, 344);
  footer(doc, "RAIMZEAL Documentation Suite – ECONTEUR LLC", pageNum);
}

// ─────────────────────────────────────────────────────────────────────────────
// USER GUIDE PDF
// ─────────────────────────────────────────────────────────────────────────────
function buildUserGuidePDF() {
  const doc = newDoc("User Guide");
  const out = path.join(OUTPUT_DIR, "RAIMZEAL-User-Guide.pdf");
  doc.pipe(fs.createWriteStream(out));
  let p = 1;

  titlePage(doc, "User Guide",
    "Everything you need to get started and get the most from RAIMZEAL —\nyour free, AI-powered health companion.");

  sectionHeading(doc, "1", "Welcome to RAIMZEAL", p++);
  contentPage(doc, "1. Welcome to RAIMZEAL", [
    { label: "Free forever — no subscriptions, no ads, no paywalls. Ever.", detail: "RAIMZEAL operates as a non-profit initiative under ECONTEUR LLC. All features are available to every user at zero cost." },
    { label: "Six health disciplines in one app", detail: "Fitness · Food Therapy · Mental Wellness · Community · Sleep & Recovery · Preventive Care" },
    { label: "Available on iOS, Android, and web", detail: "Your health data syncs automatically across all devices when you are signed in." },
    { label: "Built by Dr. Ephraim Oviawe and ECONTEUR LLC", detail: "Founded on the conviction that every person — regardless of income, location, or insurance — deserves evidence-based health guidance." },
    { label: "Your data is never sold, shared with advertisers, or monetised — ever." },
  ], p++);

  sectionHeading(doc, "2", "Getting Started", p++);
  contentPage(doc, "2.1  Creating Your Account", [
    { label: "Step 1 — Download RAIMZEAL", detail: "App Store (iOS) · Google Play (Android) · Web app at raimzeal.com" },
    { label: "Step 2 — Tap Get Started on the welcome screen" },
    { label: "Step 3 — Choose your sign-in method" },
    { label: "Step 4 — Complete your 3-minute health profile", detail: "Age · Biological sex · Height · Weight · Goals · Activity level · Dietary preferences · Health conditions (optional) · Cultural background" },
    { label: "Step 5 — Your personalised dashboard is ready" },
  ], p++);
  contentPage(doc, "2.2  Sign-In Options", [
    { label: "Sign in with Apple", detail: "Use your Apple ID. Option to hide your real email using Apple's relay — Apple forwards messages without sharing your address. Most private option available." },
    { label: "Sign in with Google", detail: "Use your Google account. RAIMZEAL only requests your name and email — no access to Gmail, Drive, or any other Google service." },
    { label: "Email & Password", detail: "Any email address and a password of your choice. You will receive a verification email. Your password is never stored in plain text." },
    { label: "Guest / Anonymous Mode", detail: "Browse RAIMZEAL without an account. Data is stored locally on your device. Upgrade to a full account at any time without losing your data." },
  ], p++);
  contentPage(doc, "2.3  Setting Up Your Profile", [
    { label: "Basic information", detail: "Age, biological sex, height, weight" },
    { label: "Health goals", detail: "Weight management, strength, mental wellness, better sleep, preventive health, or a combination" },
    { label: "Activity level", detail: "Sedentary, lightly active, moderately active, very active" },
    { label: "Dietary preferences", detail: "Omnivore, vegetarian, vegan, halal, kosher, gluten-free, or custom" },
    { label: "Health conditions (optional)", detail: "Informs safe recommendations — e.g. diabetes, hypertension. Never shared with third parties." },
    { label: "Cultural background", detail: "Helps RAIMZEAL suggest culturally relevant meals and wellness practices" },
    { label: "Update any part of your profile at any time from Settings → My Profile" },
  ], p++);

  sectionHeading(doc, "3", "Your Health Dashboard", p++);
  contentPage(doc, "3. Your Health Dashboard", [
    { label: "Daily Ring", detail: "A visual summary of your activity, nutrition, sleep, and mental wellness for today." },
    { label: "Next Action", detail: "RAIMZEAL's AI picks the single most impactful action for you today based on your history and goals." },
    { label: "Streaks", detail: "Track your consistency across programs. Streaks reset at midnight in your local timezone." },
    { label: "Weekly Summary", detail: "Every Sunday, RAIMZEAL generates a personal weekly health summary with insights and suggestions for the coming week." },
  ], p++);

  sectionHeading(doc, "4", "Fitness Programs", p++);
  contentPage(doc, "4. Fitness Programs", [
    { label: "Browse by goal", detail: "Strength, cardio, flexibility, weight loss, athletic performance — or let RAIMZEAL recommend one based on your profile." },
    { label: "Each program shows", detail: "Duration (days/weeks) · Difficulty level (Beginner, Intermediate, Advanced) · Equipment needed (none, resistance bands, dumbbells, full gym) · Time per session (15 min – 90 min) · User completion rate and community rating" },
    { label: "Guided workouts", detail: "Animated demonstrations, rep counts, rest timers, form cues. Pause and resume at any time. Substitute exercises if you lack equipment." },
    { label: "Adaptive difficulty", detail: "RAIMZEAL adjusts your program's difficulty automatically as you progress." },
    { label: "No gym required", detail: "All programs include home-friendly options using bodyweight or minimal equipment." },
    { label: "Fitness History", detail: "All completed workouts saved. Charts show workout frequency, total volume, cardio distance, and personal records." },
  ], p++);

  sectionHeading(doc, "5", "Food Therapy", p++);
  contentPage(doc, "5. Food Therapy", [
    { label: "AI Meal Planning", detail: "Personalised weekly meal plans with full recipes, ingredients, step-by-step instructions, complete nutritional breakdown, prep time, allergen substitutions, and cultural variants (West African, Caribbean, South Asian, Mediterranean, and more)." },
    { label: "Regenerate any meal", detail: "Tap the refresh icon on any meal to get an alternative instantly. Swap individual days or request a new full plan at any time." },
    { label: "Food Logging", detail: "Search 500,000+ food items, scan a barcode, or photograph your meal (AI image recognition identifies common foods automatically)." },
    { label: "Food as Medicine library", detail: "Links specific foods to health conditions based on peer-reviewed research. If you have noted a health condition, RAIMZEAL highlights beneficial foods and flags foods to minimise — with citations." },
  ], p++);

  sectionHeading(doc, "6", "Mental Wellness", p++);
  contentPage(doc, "6. Mental Wellness", [
    { label: "Daily Mood Check-In", detail: "A 1-minute daily check-in captures your emotional state. Over time, RAIMZEAL identifies patterns — what days, activities, foods, or sleep patterns correlate with better or worse moods." },
    { label: "AI-Guided Reflections", detail: "When your mood log indicates stress or difficulty, RAIMZEAL offers a brief AI-guided reflective exercise. Evidence-based techniques drawn from CBT, mindfulness, and positive psychology. Typically 5–10 minutes." },
    { label: "Stress Management Library", detail: "Breathing exercises, progressive muscle relaxation, grounding techniques, sleep-preparation routines. All available offline after first load." },
    { label: "Crisis Resources", detail: "988 Suicide & Crisis Lifeline (US) and country-specific emergency resources always accessible. RAIMZEAL is a wellness tool — not a crisis service. In a mental health emergency, contact emergency services." },
  ], p++);

  sectionHeading(doc, "7", "Community", p++);
  contentPage(doc, "7. Community", [
    { label: "Creating Posts", detail: "Tap + on the Community tab. Posts can include text, photos, workout completions, meal logs, mood check-in results, or any combination. Share publicly or to followers only." },
    { label: "Likes and Comments", detail: "Engage with posts by liking (tap the heart) or commenting. Automated moderation flags harmful content. Users can report any post or comment using the three-dot menu." },
    { label: "Community Guidelines", detail: "Be kind. No medical advice. No spam or solicitation. No content that demeans body types, ethnicities, genders, or health conditions. Moderators review all reports within 24 hours." },
    { label: "Violations", detail: "Repeated violations result in account restriction or removal. RAIMZEAL reserves the right to remove content that conflicts with its inclusive health promotion mission." },
  ], p++);

  sectionHeading(doc, "8", "Sleep & Recovery", p++);
  contentPage(doc, "8. Sleep & Recovery", [
    { label: "Sleep Logging", detail: "Record your bedtime, wake time, and sleep quality each morning. Takes under 30 seconds." },
    { label: "Sleep Score", detail: "RAIMZEAL calculates a daily sleep quality score based on duration, consistency, and self-reported quality." },
    { label: "Circadian Guidance", detail: "Personalised recommendations for bedtime, morning light exposure, and evening wind-down routines based on your chronotype." },
    { label: "Recovery Protocols", detail: "After intense workouts, RAIMZEAL recommends specific recovery techniques — sleep duration, hydration, nutrition, and active recovery — tailored to the session's intensity." },
    { label: "Sleep Hygiene Library", detail: "Evidence-based guides on sleep environment optimisation, screen use timing, caffeine guidelines, and relaxation techniques." },
  ], p++);

  sectionHeading(doc, "9", "Preventive Health", p++);
  contentPage(doc, "9. Preventive Health", [
    { label: "Health Risk Assessment", detail: "A 10-minute questionnaire covering family history, lifestyle factors, and symptoms generates a personalised risk profile across cardiovascular disease, Type 2 diabetes, certain cancers, and hypertension. Risk levels are educational, not diagnostic." },
    { label: "Screening Reminders", detail: "Based on your age, sex, and risk profile, RAIMZEAL reminds you when USPSTF-recommended health screenings are due: blood pressure, cholesterol, cancer screenings, dental visits, vision checks." },
    { label: "Symptom Tracker", detail: "Log recurring symptoms (headaches, fatigue, digestive issues, etc.). RAIMZEAL tracks patterns over time and suggests when a pattern warrants a conversation with a healthcare provider." },
    { label: "Disclaimer", detail: "All Preventive Health tools are educational and informational. They do not constitute medical advice, diagnosis, or treatment. Always consult a licensed healthcare provider for medical decisions." },
  ], p++);

  sectionHeading(doc, "10", "Privacy & Your Data", p++);
  contentPage(doc, "10. What We Collect", [
    { label: "Account information", detail: "Email or OAuth token, display name" },
    { label: "Health profile data you enter", detail: "Age, goals, dietary preferences" },
    { label: "Activity logs you create", detail: "Workouts, meals, mood check-ins, sleep logs" },
    { label: "App usage data", detail: "Screens visited, features used — anonymised and aggregated only" },
  ], p++);
  contentPage(doc, "10. What We Never Do & Your Rights", [
    { label: "NEVER sell your data to any third party — ever" },
    { label: "NEVER use your data for advertising purposes" },
    { label: "NEVER share individually identifiable health data with insurers, employers, or government (except when legally required)" },
    { label: "NEVER store payment information — RAIMZEAL is free, no payments are ever processed" },
    { label: "EXPORT your data", detail: "Request a full data export at any time: Settings → Privacy → Export My Data" },
    { label: "DELETE your account", detail: "Permanent deletion from Settings → Privacy → Delete Account. Completes within 30 days and is irreversible." },
    { label: "Data storage", detail: "Supabase PostgreSQL with Row Level Security. All data encrypted at rest and in transit." },
  ], p++);

  sectionHeading(doc, "11", "Troubleshooting & Support", p++);
  contentPage(doc, "11. Common Issues & Support", [
    { label: "Can't sign in", detail: "Use the same sign-in method you used to create your account. Apple Sign In users must sign in with Apple. Use Forgot Password for email accounts." },
    { label: "Data didn't sync", detail: "Sync requires an internet connection. Pull down on the dashboard to force a manual sync. Sign out and back in for a full re-sync." },
    { label: "Workout video won't load", detail: "Move to a better network connection, or use the text-only mode toggle in the workout screen's settings menu." },
    { label: "Meal plan doesn't match preferences", detail: "Revisit Settings → My Profile → Dietary Preferences, then regenerate your plan from the Food Therapy tab (three-dot menu → Regenerate Plan)." },
    { label: "Found a bug", detail: "Settings → Help → Report a Bug. RAIMZEAL reviews all bug reports and prioritises fixes in weekly releases." },
    { label: "Contact Support", detail: "support@raimzeal.com  ·  Settings → Help → Contact Support  ·  Response: within 48 hours on business days" },
  ], p++);

  closingPage(doc, "User Guide", p);
  doc.end();
  console.log(`✅  User Guide PDF → ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVELOPER GUIDE PDF
// ─────────────────────────────────────────────────────────────────────────────
function buildDeveloperGuidePDF() {
  const doc = newDoc("Developer Guide");
  const out = path.join(OUTPUT_DIR, "RAIMZEAL-Developer-Guide.pdf");
  doc.pipe(fs.createWriteStream(out));
  let p = 1;

  titlePage(doc, "Developer Guide",
    "Technical reference for engineers building on or contributing to RAIMZEAL.\nCovers architecture, API, mobile, database, auth, and deployment.");

  sectionHeading(doc, "1", "Architecture Overview", p++);
  contentPage(doc, "1.1  Monorepo Structure", [
    { label: "artifacts/api-server", detail: "Express 5 REST API — all server-side logic, Drizzle ORM queries, Supabase integration, Pino logging" },
    { label: "artifacts/raimzeal", detail: "React + Vite web app — client-side web app, served at /" },
    { label: "artifacts/raimzeal-mobile", detail: "Expo SDK 54 mobile app — iOS + Android. File-based routing via expo-router v4." },
    { label: "lib/db", detail: "Drizzle ORM schema + Supabase client — shared database layer consumed by api-server" },
    { label: "lib/api-spec", detail: "OpenAPI 3.1 spec + Orval codegen outputs — source of truth for all API contracts. Generates React Query hooks + Zod schemas." },
    { label: "scripts/", detail: "Shared utility scripts (sync-github, seed, generate, etc.)" },
    { label: "pnpm-workspace.yaml", detail: "Catalog pins and workspace config. package.json has root task orchestration and shared dev tooling." },
  ], p++);
  tablePage(doc, "1.2  Service Map",
    ["Service", "Package", "Path", "Tech Stack"],
    [
      ["REST API", "@workspace/api-server", "/api", "Express 5, Drizzle ORM, Pino"],
      ["Web App", "@workspace/raimzeal", "/", "React, Vite, TailwindCSS, Wouter"],
      ["Mobile App", "@workspace/raimzeal-mobile", "Expo dev", "Expo SDK 54, React Native"],
      ["Database", "@workspace/db", "Supabase cloud", "PostgreSQL, Drizzle, RLS"],
      ["API Spec", "@workspace/api-spec", "—", "OpenAPI 3.1, Orval codegen"],
    ], p++, [105, 145, 80, 165]);
  contentPage(doc, "1.3  Data Flow", [
    { label: "All client-server communication goes through the REST API at /api" },
    { label: "Web + mobile use React Query hooks generated by Orval from the OpenAPI spec" },
    { label: "Authentication", detail: "Supabase client SDK issues JWTs. API server validates against Supabase JWKS endpoint via requireAuth middleware." },
    { label: "Database access", detail: "Drizzle ORM queries Supabase PostgreSQL. Server uses the service role key — clients always use the anon key only." },
    { label: "Flow", detail: "Client → Auth (Supabase JWT) → /api/* → requireAuth middleware → Drizzle ORM → Supabase PostgreSQL" },
  ], p++);

  sectionHeading(doc, "2", "Prerequisites & Setup", p++);
  contentPage(doc, "2.1  Required Tools", [
    { label: "Node.js 20+ (LTS recommended)" },
    { label: "pnpm 9+ (workspace package manager)" },
    { label: "EAS CLI", detail: "npm install -g eas-cli" },
    { label: "Git" },
    { label: "A Supabase account (free tier sufficient for development)" },
  ], p++);
  tablePage(doc, "2.2  Environment Variables",
    ["Variable", "Used By", "Notes"],
    [
      ["SUPABASE_URL", "API, Mobile, Web", "Your Supabase project URL"],
      ["SUPABASE_ANON_KEY", "API, Mobile, Web", "Public anon key — safe for clients"],
      ["SUPABASE_SERVICE_ROLE_KEY", "API server only", "Never expose to any client"],
      ["OPENAI_API_KEY", "API server only", "Powers meal plan + fitness AI generation"],
      ["DATABASE_URL", "API (migrations)", "PostgreSQL connection string for Drizzle"],
      ["EXPO_TOKEN", "EAS builds", "EAS project access token"],
    ], p++, [155, 110, 230]);
  contentPage(doc, "2.3  First-Time Setup", [
    { label: "Clone the repo and enter the workspace directory" },
    { label: "pnpm install", detail: "Installs all workspace dependencies" },
    { label: "pnpm --filter @workspace/api-server run db:migrate", detail: "Applies database migrations" },
    { label: "pnpm run typecheck", detail: "Runs full TypeScript check across all packages — must pass with zero errors" },
    { label: "pnpm --filter @workspace/api-spec run codegen", detail: "Regenerates API client after spec changes" },
    { label: "On Replit — restart workflows from the Replit UI instead of running pnpm dev at the workspace root" },
  ], p++);

  sectionHeading(doc, "3", "Running the Project", p++);
  contentPage(doc, "3. Running Individual Services", [
    { label: "API server", detail: "pnpm --filter @workspace/api-server run dev" },
    { label: "Web app", detail: "pnpm --filter @workspace/raimzeal run dev" },
    { label: "Mobile app", detail: "pnpm --filter @workspace/raimzeal-mobile run dev" },
    { label: "Full typecheck", detail: "pnpm run typecheck" },
    { label: "Lib typecheck (if lib/ changed)", detail: "pnpm run typecheck:libs" },
    { label: "Codegen (if openapi.yaml changed)", detail: "pnpm --filter @workspace/api-spec run codegen" },
  ], p++);

  sectionHeading(doc, "4", "API Reference", p++);
  contentPage(doc, "4.1  Authentication", [
    { label: "All authenticated endpoints require", detail: "Authorization: Bearer <supabase-jwt>" },
    { label: "JWT validated", detail: "Against Supabase JWKS endpoint by requireAuth middleware" },
    { label: "Unauthenticated requests to protected routes", detail: "→ 401 Unauthorized" },
    { label: "Public endpoints (no auth required)", detail: "GET /api/healthz" },
    { label: "Never log or expose JWTs in server code", detail: "Use req.log for server logging (Pino). Never console.log in server code." },
  ], p++);
  tablePage(doc, "4.2  Core API Endpoints",
    ["Method", "Endpoint", "Auth", "Description"],
    [
      ["GET", "/api/healthz", "Public", "Health check — returns 200 OK"],
      ["GET", "/api/users/me", "Required", "Authenticated user's profile and preferences"],
      ["POST", "/api/meal-plans/generate", "Required", "Generate personalised weekly meal plan (OpenAI)"],
      ["GET", "/api/fitness/programs", "Required", "Programs filtered by user's profile and goals"],
      ["POST", "/api/community/posts", "Required", "Create a community post {content, type, visibility}"],
      ["POST", "/api/health-logs", "Required", "Log a health event (workout, meal, mood, sleep)"],
    ], p++, [50, 165, 65, 215]);
  contentPage(doc, "4.3  OpenAPI Codegen", [
    { label: "Spec location", detail: "lib/api-spec/openapi.yaml — source of truth for all API contracts" },
    { label: "After modifying the spec, run codegen", detail: "pnpm --filter @workspace/api-spec run codegen" },
    { label: "Generated files", detail: "lib/api-spec/src/generated/ — DO NOT edit manually; overwritten on every codegen" },
    { label: "Codegen produces", detail: "React Query hooks (used by web + mobile) and Zod validation schemas (used by the API server)" },
  ], p++);

  sectionHeading(doc, "5", "Database", p++);
  tablePage(doc, "5.1  Core Tables",
    ["Table", "Description"],
    [
      ["users", "User accounts — synced from Supabase auth.users"],
      ["user_profiles", "Health profile: goals, dietary prefs, activity level, conditions"],
      ["health_logs", "All user health events (workouts, meals, mood, sleep)"],
      ["meal_plans", "Generated meal plans, stored as JSONB"],
      ["fitness_programs", "Program catalog with exercises, sets, reps"],
      ["community_posts", "User-generated community content"],
      ["post_reactions", "Likes and reactions on community posts"],
      ["comments", "Comments on community posts"],
    ], p++, [160, 335]);
  contentPage(doc, "5.2  Migrations & Row Level Security", [
    { label: "Generate a migration", detail: "pnpm --filter @workspace/api-server run db:generate" },
    { label: "Apply migrations", detail: "pnpm --filter @workspace/api-server run db:migrate" },
    { label: "Open Drizzle Studio (DB browser)", detail: "pnpm --filter @workspace/api-server run db:studio" },
    { label: "Row Level Security", detail: "All production tables have RLS enabled. Users can only read and write their own rows." },
    { label: "Service role key", detail: "Bypasses RLS. Must NEVER be exposed to client code. Server only." },
    { label: "Anon key", detail: "Always use the anon key in client-side code (web app, mobile app)." },
  ], p++);

  sectionHeading(doc, "6", "Authentication", p++);
  contentPage(doc, "6. Authentication (Supabase Auth)", [
    { label: "Apple Sign In", detail: "Configured with Apple Services ID + private key in Supabase Auth settings. Required for iOS (App Store Guideline 4.8). Uses expo-apple-authentication on native, Supabase OAuth redirect on web." },
    { label: "Google OAuth", detail: "Configured with Google Cloud OAuth client in Supabase Auth settings. Uses expo-auth-session on mobile — NOT @react-native-google-signin (incompatible with Expo managed workflow)." },
    { label: "Email/password", detail: "Enabled with mandatory email verification." },
    { label: "Anonymous sign-in", detail: "Enabled for guest mode." },
    { label: "iOS Bundle ID", detail: "app.replit.raimzeal — DO NOT CHANGE" },
    { label: "Android Package", detail: "com.econteur.raimzeal — DO NOT CHANGE" },
  ], p++);

  sectionHeading(doc, "7", "Mobile App (Expo)", p++);
  tablePage(doc, "7.1  Key Dependencies",
    ["Package", "Purpose"],
    [
      ["expo-router v4", "File-based navigation"],
      ["@supabase/supabase-js", "Auth + database client"],
      ["expo-apple-authentication", "Apple Sign In (required for iOS)"],
      ["expo-auth-session", "Google OAuth on mobile"],
      ["@tanstack/react-query", "Data fetching + caching"],
      ["nativewind", "Tailwind CSS for React Native"],
      ["expo-camera", "Food barcode scanning and photo logging"],
    ], p++, [220, 275]);
  contentPage(doc, "7.2  EAS Build Commands", [
    { label: "Development build (local simulator)", detail: "eas build --profile development --platform ios" },
    { label: "Preview build (TestFlight / internal testing)", detail: "eas build --profile preview --platform ios" },
    { label: "Production build (App Store)", detail: "eas build --profile production --platform ios" },
    { label: "Submit to App Store (after production build)", detail: "eas submit --platform ios --latest" },
    { label: "Android production build", detail: "eas build --profile production --platform android" },
    { label: "Submit to Google Play", detail: "eas submit --platform android --latest" },
    { label: "Note", detail: "EAS build must be run from a local machine — Replit blocks git commands needed by EAS." },
  ], p++);

  sectionHeading(doc, "8", "Deployment", p++);
  contentPage(doc, "8. Deployment", [
    { label: "API + Web — Replit Autoscale", detail: "Deployed via Replit deployment system. Production URL: raimzeal.com (.replit.app or custom domain)." },
    { label: "Healthcheck", detail: "GET /api/healthz polled to confirm deployment is live. Set up UptimeRobot to monitor it every 5 minutes." },
    { label: "Environment variables", detail: "Set separately in Replit deployment environment — not in .env files." },
    { label: "iOS/Android stores", detail: "EAS build (local machine) → eas submit → App Store Connect / Play Console review → Live" },
    { label: "Deployment cost", detail: "~$19/month (Replit Starter plan)" },
  ], p++);

  sectionHeading(doc, "9", "Contributing", p++);
  contentPage(doc, "9. Contributing Standards", [
    { label: "Branch strategy", detail: "main (always deployable) · feature/<desc> · fix/<desc>" },
    { label: "TypeScript strict mode", detail: "No any types permitted. tsc --strict enforced across all packages." },
    { label: "No console.log in server code", detail: "Use req.log in route handlers and the singleton logger for non-request code." },
    { label: "API changes", detail: "Update OpenAPI spec first, then run codegen to regenerate client types." },
    { label: "Database changes", detail: "Must include a Drizzle migration. Never manually edit the database schema." },
    { label: "All new routes", detail: "Must use requireAuth middleware unless explicitly designed to be public." },
    { label: "Pre-commit checklist", detail: "pnpm run typecheck (zero errors required) · pnpm run typecheck:libs (if lib/ changed) · pnpm --filter @workspace/api-spec run codegen (if openapi.yaml changed)" },
  ], p++);

  closingPage(doc, "Developer Guide", p);
  doc.end();
  console.log(`✅  Developer Guide PDF → ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONS GUIDE PDF
// ─────────────────────────────────────────────────────────────────────────────
function buildOperationsGuidePDF() {
  const doc = newDoc("Operations Guide");
  const out = path.join(OUTPUT_DIR, "RAIMZEAL-Operations-Guide.pdf");
  doc.pipe(fs.createWriteStream(out));
  let p = 1;

  titlePage(doc, "Operations Guide",
    "Platform status · infrastructure costs · maintenance · monitoring\ngrant strategy · 501(c)(3) setup · incident response · scaling plan");

  sectionHeading(doc, "1", "Platform Status — June 2026", p++);
  contentPage(doc, "1. Platform Status — June 2026", [
    { label: "API Server — OPERATIONAL", detail: "Running on Replit Autoscale. Healthcheck: GET /api/healthz. Monitored every 5 minutes." },
    { label: "Web App — OPERATIONAL", detail: "Deployed at raimzeal.com. Row Level Security enabled on all tables." },
    { label: "Supabase Database — OPERATIONAL", detail: "Free tier. 500MB storage. Row Level Security on all tables." },
    { label: "iOS App Store — SUBMISSION IN PROGRESS", detail: "Compliance audit complete. Apple Sign In approved. Awaiting App Store review." },
    { label: "Android Google Play — PLANNED Q3 2026", detail: "EAS Android build ready. Google Play Developer account setup pending." },
    { label: "Version — v1.3.0", detail: "iOS Bundle: app.replit.raimzeal · Android: com.econteur.raimzeal" },
  ], p++);

  sectionHeading(doc, "2", "Infrastructure & Monthly Costs", p++);
  tablePage(doc, "2.1  Monthly Cost Breakdown",
    ["Service", "Plan", "Monthly", "Annual", "Notes"],
    [
      ["Replit", "Starter", "$19.00", "$228.00", "API + web app + all artifacts"],
      ["EAS (Expo)", "Starter", "$19.00", "$228.00", "Mobile builds — iOS + Android"],
      ["Apple Developer", "Individual", "~$8.25", "$99.00", "Billed annually"],
      ["Supabase", "Free", "$0.00", "$0.00", "Up to 50K MAU, 500MB storage"],
      ["Domain", "Annual", "~$1.50", "~$18.00", "raimzeal.com"],
      ["OpenAI API", "Pay-as-you-go", "~$3.00", "~$36.00", "Scales with usage"],
      ["TOTAL", "—", "~$50.75", "~$609.00", "Supports 50K MAU at this cost"],
    ], p++, [90, 80, 55, 60, 210]);
  tablePage(doc, "2.2  Grant Runway Analysis",
    ["Grant Size", "Runway at $609/yr", "Source Example"],
    [
      ["$10,000", "16 years", "Small health foundation grant"],
      ["$50,000", "82 years", "NIH supplemental or community health grant"],
      ["$250,000", "410 years", "Gates Foundation / major health-focused donor"],
      ["$500,000", "820 years", "Mid-size institutional grant"],
      ["$1,000,000", "1,642 years", "Major institutional grant (NIH, CDC, RWJF)"],
    ], p++, [100, 110, 285]);

  sectionHeading(doc, "3", "Maintenance Schedule", p++);
  contentPage(doc, "3. Maintenance Schedule", [
    { label: "DAILY (5 min)", detail: "Check Replit deployment healthcheck · Review new bug reports · Check Supabase for auth or database error alerts" },
    { label: "WEEKLY (30 min)", detail: "Community moderation queue · OpenAI usage dashboard for cost spikes · Supabase query performance · Check pnpm outdated · Review Expo + EAS release notes" },
    { label: "MONTHLY (2–3 hr)", detail: "Apply security dependency updates + run typechecks · Review Supabase RLS policies · Review USPSTF screening guidelines · App analytics review · Invoice review · Back up OpenAPI spec + DB schema · Release new app version if fixes/features accumulated" },
    { label: "ANNUALLY", detail: "Renew Apple Developer Program ($99) · Renew domain · Review privacy policy (HIPAA, GDPR, CCPA) · Full security audit (dependency, SAST, hound-dog) · Review 501(c)(3) compliance requirements" },
  ], p++);

  sectionHeading(doc, "4", "Monitoring & Alerts", p++);
  contentPage(doc, "4. Monitoring & Uptime Alerts", [
    { label: "Healthcheck endpoint", detail: "GET /api/healthz returns HTTP 200 when API + database are healthy" },
    { label: "Manual check", detail: "curl -sf https://raimzeal.com/api/healthz && echo 'API healthy'" },
    { label: "Supabase dashboard", detail: "app.supabase.com → your project → Logs → API logs · Database → Query Performance · Auth → Users" },
    { label: "Free uptime monitoring — highly recommended (UptimeRobot / Better Uptime / Freshping)", detail: "1. Create free account at uptimerobot.com  2. Add HTTP(s) monitor  3. URL: https://raimzeal.com/api/healthz  4. Interval: 5 min  5. Add email alert  6. Save. You will receive email within 5 min of any outage." },
    { label: "Supabase storage limit", detail: "Free tier: 500MB. When approaching 400MB, migrate to Supabase Pro ($25/month, 8GB storage, 100K MAU)." },
  ], p++);

  sectionHeading(doc, "5", "App Store Management", p++);
  contentPage(doc, "5.1  iOS App Store Updates", [
    { label: "Step 1 — Code changes + test on simulator or TestFlight" },
    { label: "Step 2 — Bump version + ios.buildNumber in app.json" },
    { label: "Step 3 — Build (from local machine, NOT Replit)", detail: "eas build --profile production --platform ios" },
    { label: "Step 4 — Submit", detail: "eas submit --platform ios --latest" },
    { label: "Step 5 — Complete App Store Connect submission metadata and What's New" },
    { label: "Step 6 — Submit for review", detail: "First submissions: 24–72 hours. Updates: usually faster." },
    { label: "Key identifiers — DO NOT CHANGE", detail: "iOS Bundle ID: app.replit.raimzeal · Apple Team ID: stored in EAS credentials" },
  ], p++);
  contentPage(doc, "5.2  Android Google Play (Planned Q3 2026)", [
    { label: "Step 1 — Create Google Play Developer account ($25 one-time fee)" },
    { label: "Step 2 — Build", detail: "eas build --profile production --platform android" },
    { label: "Step 3 — Submit", detail: "eas submit --platform android --latest" },
    { label: "Step 4 — Complete Play Store listing", detail: "Description, screenshots, privacy policy URL, data safety form" },
    { label: "Step 5 — Initial review: 3–7 business days for new apps" },
    { label: "Android package name — DO NOT CHANGE", detail: "com.econteur.raimzeal" },
  ], p++);

  sectionHeading(doc, "6", "Investor & Grant Strategy", p++);
  contentPage(doc, "6.1  Priority Grant Sources", [
    { label: "NIH SBIR Phase I — up to $300K", detail: "6-month feasibility study. Food Therapy AI and preventive health modules are strong fits. grants.nih.gov/grants/funding/sbir.htm — ongoing submissions." },
    { label: "Robert Wood Johnson Foundation — $50K–$500K", detail: "Health equity focus. RAIMZEAL's free access + culturally adaptive nutrition = direct alignment. rwjf.org — targeted RFPs." },
    { label: "Gates Foundation — $100K–$2M", detail: "Global health / low- and middle-income countries. Smartphone-first, free, culturally adaptable. Unsolicited proposals accepted. gatesfoundation.org/about/how-we-work/general-purpose-grants-program" },
    { label: "CDC Prevention Research Centers — $100K–$1M", detail: "Community-based health promotion. Annual RFA cycle (typically August). cdc.gov/prc" },
    { label: "Apple App Store Small Business Program", detail: "Developer support + marketing opportunities + Apple Health partnerships. Apply after app goes live. developer.apple.com/app-store/small-business-program" },
  ], p++);
  contentPage(doc, "6.2  Institutional Partnerships", [
    { label: "Hospital systems", detail: "Free patient wellness tool. Hospitals benefit from patient engagement + reduced readmissions. RAIMZEAL benefits from clinical validation + user acquisition." },
    { label: "HBCUs and minority-serving universities", detail: "Student wellness programs. Free campus license; institutions provide research access and user base." },
    { label: "FQHCs (Federally Qualified Health Centers)", detail: "Serve underserved populations. RAIMZEAL's free, culturally adaptive approach aligns directly with their mission." },
    { label: "Corporate wellness programs", detail: "Employers offer RAIMZEAL free to employees. Employers pay nothing; RAIMZEAL gains users and grant credibility." },
  ], p++);
  tablePage(doc, "6.3  Grant Application Timeline",
    ["Milestone", "Target", "Notes"],
    [
      ["iOS live on App Store", "Q2 2026", "Required for most grant applications"],
      ["501(c)(3) application filed", "Q3 2026", "Required for most foundation grants"],
      ["First NIH SBIR submission", "Q3 2026", "Requires 501(c)(3) or SBIR-eligible entity"],
      ["RWJF letter of inquiry", "Q4 2026", "After first 10,000 users achieved"],
      ["Gates Foundation proposal", "H1 2027", "Requires demonstrated user growth + outcomes data"],
    ], p++, [160, 75, 260]);

  sectionHeading(doc, "7", "501(c)(3) Foundation Setup", p++);
  contentPage(doc, "7.1  Recommended Approach — New 501(c)(3)", [
    { label: "Incorporate a new non-profit (e.g. RAIMZEAL Health Foundation)", detail: "ECONTEUR LLC licenses the RAIMZEAL platform to the foundation for $0/year. Foundation holds all grant revenue and mission commitments. ECONTEUR LLC remains as technology developer under a service agreement." },
    { label: "Estimated cost", detail: "$300–$1,000 state filing fees + $275 IRS 1023-EZ fee (or $600 for full Form 1023)" },
    { label: "Timeline", detail: "~2–3 months using Form 1023-EZ" },
  ], p++);
  contentPage(doc, "7.2  10-Step 501(c)(3) Process", [
    { label: "Step 1 — Choose incorporation state", detail: "Delaware most common; your home state also fine. State filing fee: $50–$200." },
    { label: "Step 2 — Draft Articles of Incorporation", detail: "Must include: specific public benefit purpose statement, dissolution clause (assets go to another 501(c)(3)), prohibition on private inurement." },
    { label: "Step 3 — Appoint Board of Directors", detail: "Minimum 3 directors. At least 1 must be independent (not paid staff). Dr. Oviawe serves as Executive Director." },
    { label: "Step 4 — File Articles with Secretary of State", detail: "Fee: $50–$200. Processing: 1–4 weeks." },
    { label: "Step 5 — Obtain EIN from IRS", detail: "Free, same day at irs.gov. Required before any other IRS filings." },
    { label: "Step 6 — Draft bylaws + conflict of interest policy", detail: "Required by IRS. Governs how the board operates, votes, and handles conflicts." },
    { label: "Step 7 — File IRS Form 1023-EZ or 1023", detail: "1023-EZ ($275, 2–6 weeks) if projected receipts <$50K/yr for 3 years. Full 1023 ($600, 3–6 months) otherwise." },
    { label: "Step 8 — Register for charitable solicitation in your state" },
    { label: "Step 9 — Open a non-profit bank account", detail: "Required before receiving any grant funds." },
    { label: "Step 10 — Execute platform license agreement", detail: "ECONTEUR LLC licenses RAIMZEAL to the Foundation at $0/year with a mission-lock clause." },
  ], p++);
  contentPage(doc, "7.3  Required Document Checklist", [
    { label: "☐  Articles of Incorporation (filed and stamped by Secretary of State)" },
    { label: "☐  Federal EIN confirmation letter (IRS SS-4)" },
    { label: "☐  Organizational bylaws" },
    { label: "☐  Conflict of interest policy" },
    { label: "☐  IRS Form 1023 or 1023-EZ application" },
    { label: "☐  IRS determination letter (tax-exempt status confirmation)" },
    { label: "☐  State charitable solicitation registration (if applicable)" },
    { label: "☐  Board meeting minutes from organizational meeting" },
    { label: "☐  Non-profit bank account setup" },
    { label: "☐  Platform license agreement (ECONTEUR LLC → Foundation at $0/year)" },
  ], p++);

  sectionHeading(doc, "8", "Incident Response", p++);
  contentPage(doc, "8. Incident Response Protocols", [
    { label: "API OUTAGE", detail: "1. Check Replit deployment status — restart if down  2. Check for recent deploys causing outage — roll back if needed  3. Check Supabase status at status.supabase.com  4. Review server logs in Replit  5. Post status update to community if unresolved after 30 minutes" },
    { label: "DATA BREACH", detail: "1. Immediately rotate all Supabase API keys + invalidate sessions  2. Disable anon key + generate new one  3. Assess scope (which tables, what data)  4. Notify affected users within 72 hrs (GDPR) / 60 days (HIPAA)  5. File FTC report if >500 state residents affected  6. Document incident, remediation, and preventive measures" },
    { label: "INAPPROPRIATE CONTENT", detail: "In-app report reviewed within 24 hrs · Violations: delete + warn user · Repeated violations: restrict account · Illegal content (CSAM, credible threats): report to NCMEC/FBI, preserve evidence, delete content, permanent ban" },
  ], p++);

  sectionHeading(doc, "9", "Scaling Plan", p++);
  contentPage(doc, "9. Scaling Plan by User Tier", [
    { label: "0 – 50,000 MAU — Current setup: ~$51/month", detail: "Supabase free tier handles this range (500MB storage, 50K MAU). Replit Starter plan is sufficient. No infrastructure changes required." },
    { label: "50,000 – 500,000 MAU — ~$100–$200/month", detail: "Upgrade Supabase to Pro ($25/mo, 100K MAU, 8GB storage) + Replit Autoscale compute + OpenAI response caching for common meal plan types + Supabase read replicas for performance." },
    { label: "500,000 – 5M MAU — ~$500–$2,000/month", detail: "Supabase Team ($599/mo, unlimited MAU, 100GB) + dedicated cloud API server (AWS / GCP / Fly.io) + Redis caching layer + CDN for static assets (Cloudflare free tier) + apply for AWS Nonprofit Credits ($2,000/year)." },
    { label: "5M+ MAU — Dedicated engineering required", detail: "Hire 1+ full-time platform engineer (grant-funded) + horizontal API scaling + formal SRE (Site Reliability Engineering) practice + WHO partnership support at this level of global impact." },
    { label: "Key milestone", detail: "Supabase free tier supports 50,000 MAU with zero incremental cost — very generous for early growth." },
  ], p++);

  closingPage(doc, "Operations Guide", p);
  doc.end();
  console.log(`✅  Operations Guide PDF → ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("Generating RAIMZEAL Documentation PDF files...\n");
buildUserGuidePDF();
buildDeveloperGuidePDF();
buildOperationsGuidePDF();
console.log("\nAll 3 PDF files generated.");
