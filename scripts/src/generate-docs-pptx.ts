import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS = require("pptxgenjs") as any;
import * as fs from "fs";
import * as path from "path";

// ─── RAIMZEAL Brand ───────────────────────────────────────────────────────────
const BRAND = {
  bg: "0D0D0D",
  surface: "1A1A1A",
  gold: "C8A84B",
  green: "2D8C4E",
  white: "F0EDE8",
  muted: "888888",
  border: "2A2A2A",
};

const OUTPUT_DIR = path.join(process.cwd(), ".local", "outputs");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function newDeck(title: string) {
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
  prs.title = title;
  prs.author = "Dr. Ephraim Oviawe – ECONTEUR LLC";
  prs.subject = `RAIMZEAL – ${title}`;
  return prs;
}

type PptxDeck = ReturnType<typeof newDeck>;

function addTopBar(slide: any) {
  slide.addShape("rect", {
    x: 0, y: 0, w: "100%", h: 0.05,
    fill: { color: BRAND.gold },
    line: { type: "none" },
  });
}

function addFooter(slide: any, label: string, pageNum: string) {
  slide.addShape("rect", {
    x: 0, y: 7.3, w: "100%", h: 0.2,
    fill: { color: BRAND.surface },
    line: { type: "none" },
  });
  slide.addText(label, {
    x: 0.3, y: 7.32, w: 9, h: 0.16,
    fontSize: 7, color: BRAND.muted, fontFace: "Source Sans 3",
  });
  slide.addText(pageNum, {
    x: 10, y: 7.32, w: 3, h: 0.16, align: "right",
    fontSize: 7, color: BRAND.muted, fontFace: "Source Sans 3",
  });
}

function titleSlide(prs: PptxDeck, docTitle: string, subtitle: string) {
  const slide = prs.addSlide();
  // Gradient background
  slide.background = { color: BRAND.bg };
  // Gold accent bar left
  slide.addShape("rect", {
    x: 0, y: 0, w: 0.12, h: "100%",
    fill: { color: BRAND.gold }, line: { type: "none" },
  });
  // RAIMZEAL wordmark
  slide.addText("RAIMZEAL", {
    x: 0.5, y: 1.5, w: 12, h: 1.2,
    fontSize: 72, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
  });
  slide.addText(docTitle, {
    x: 0.5, y: 2.8, w: 12, h: 0.7,
    fontSize: 32, bold: false, color: BRAND.white, fontFace: "Source Sans 3",
  });
  slide.addText(subtitle, {
    x: 0.5, y: 3.55, w: 10, h: 0.45,
    fontSize: 16, color: BRAND.muted, fontFace: "Source Sans 3",
  });
  // Bottom meta
  slide.addText("ECONTEUR LLC  ·  Dr. Ephraim Oviawe  ·  June 2026  ·  raimzeal.com", {
    x: 0.5, y: 6.8, w: 12, h: 0.3,
    fontSize: 10, color: BRAND.muted, fontFace: "Source Sans 3",
  });
  slide.addText("FREE · OPEN · EVIDENCE-BASED", {
    x: 0.5, y: 7.1, w: 5, h: 0.25,
    fontSize: 9, color: BRAND.green, bold: true, fontFace: "Source Sans 3",
  });
}

function sectionTitle(prs: PptxDeck, num: string, heading: string, total: string) {
  const slide = prs.addSlide();
  slide.background = { color: BRAND.bg };
  addTopBar(slide);
  // Section number bubble
  slide.addShape("ellipse", {
    x: 0.4, y: 1.2, w: 1.1, h: 1.1,
    fill: { color: BRAND.gold }, line: { type: "none" },
  });
  slide.addText(num, {
    x: 0.4, y: 1.2, w: 1.1, h: 1.1, align: "center", valign: "middle",
    fontSize: 32, bold: true, color: BRAND.bg, fontFace: "Source Sans 3",
  });
  slide.addText(heading, {
    x: 0.4, y: 2.5, w: 12, h: 0.9,
    fontSize: 44, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
  });
  slide.addShape("rect", {
    x: 0.4, y: 3.55, w: 2.5, h: 0.06,
    fill: { color: BRAND.green }, line: { type: "none" },
  });
  addFooter(slide, "RAIMZEAL Documentation Suite – ECONTEUR LLC", total);
}

function contentSlide(
  prs: PptxDeck,
  heading: string,
  bullets: { text: string; sub?: string }[],
  footer: string
) {
  const slide = prs.addSlide();
  slide.background = { color: BRAND.bg };
  addTopBar(slide);
  slide.addText(heading, {
    x: 0.4, y: 0.18, w: 12.5, h: 0.62,
    fontSize: 22, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
  });
  // Content area card
  slide.addShape("rect", {
    x: 0.3, y: 0.92, w: 12.73, h: 6.1,
    fill: { color: BRAND.surface }, line: { color: BRAND.border, pt: 1 }, rounding: true,
  });
  const items: any[] = [];
  bullets.forEach((b) => {
    items.push({
      text: b.text,
      options: {
        fontSize: 13, color: BRAND.white, fontFace: "Source Sans 3",
        bullet: { type: "bullet", characterCode: "25A0", color: BRAND.gold },
        paraSpaceBefore: 6,
      },
    });
    if (b.sub) {
      items.push({
        text: b.sub,
        options: {
          fontSize: 11, color: BRAND.muted, fontFace: "Source Sans 3",
          indentLevel: 1, paraSpaceBefore: 2,
        },
      });
    }
  });
  slide.addText(items, {
    x: 0.55, y: 1.05, w: 12.2, h: 5.8, valign: "top",
  });
  addFooter(slide, "RAIMZEAL Documentation Suite – ECONTEUR LLC", footer);
}

function twoColSlide(
  prs: PptxDeck,
  heading: string,
  left: { title: string; body: string }[],
  right: { title: string; body: string }[],
  footer: string
) {
  const slide = prs.addSlide();
  slide.background = { color: BRAND.bg };
  addTopBar(slide);
  slide.addText(heading, {
    x: 0.4, y: 0.18, w: 12.5, h: 0.62,
    fontSize: 22, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
  });
  const colW = 6.2;
  const cols = [
    { x: 0.3, items: left },
    { x: 6.83, items: right },
  ];
  cols.forEach(({ x, items }) => {
    let yPos = 1.0;
    items.forEach((item) => {
      slide.addShape("rect", {
        x, y: yPos, w: colW, h: 1.28,
        fill: { color: BRAND.surface }, line: { color: BRAND.border, pt: 1 }, rounding: true,
      });
      slide.addText(item.title, {
        x: x + 0.18, y: yPos + 0.1, w: colW - 0.36, h: 0.3,
        fontSize: 12, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
      });
      slide.addText(item.body, {
        x: x + 0.18, y: yPos + 0.42, w: colW - 0.36, h: 0.8,
        fontSize: 10, color: BRAND.muted, fontFace: "Source Sans 3",
      });
      yPos += 1.38;
    });
  });
  addFooter(slide, "RAIMZEAL Documentation Suite – ECONTEUR LLC", footer);
}

function tableSlide(
  prs: PptxDeck,
  heading: string,
  headers: string[],
  rows: string[][],
  footer: string
) {
  const slide = prs.addSlide();
  slide.background = { color: BRAND.bg };
  addTopBar(slide);
  slide.addText(heading, {
    x: 0.4, y: 0.18, w: 12.5, h: 0.62,
    fontSize: 22, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
  });
  const tableData: any[] = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, color: BRAND.gold, fill: { color: BRAND.surface }, fontSize: 11 },
    })),
    ...rows.map((r) =>
      r.map((cell) => ({
        text: cell,
        options: { color: BRAND.white, fill: { color: BRAND.bg }, fontSize: 10 },
      }))
    ),
  ];
  slide.addTable(tableData, {
    x: 0.3, y: 0.98, w: 12.73, h: 6.1,
    border: { pt: 1, color: BRAND.border },
    fontFace: "Source Sans 3",
    rowH: 0.42,
  });
  addFooter(slide, "RAIMZEAL Documentation Suite – ECONTEUR LLC", footer);
}

function closingSlide(prs: PptxDeck, guideTitle: string) {
  const slide = prs.addSlide();
  slide.background = { color: BRAND.bg };
  slide.addShape("rect", {
    x: 0, y: 0, w: 0.12, h: "100%",
    fill: { color: BRAND.gold }, line: { type: "none" },
  });
  slide.addText("RAIMZEAL", {
    x: 0.5, y: 2.2, w: 12, h: 0.9,
    fontSize: 54, bold: true, color: BRAND.gold, fontFace: "Source Sans 3",
  });
  slide.addText(`End of ${guideTitle}`, {
    x: 0.5, y: 3.2, w: 12, h: 0.5,
    fontSize: 22, color: BRAND.white, fontFace: "Source Sans 3",
  });
  slide.addText("Free · Open · Evidence-Based Healthcare for Every Human", {
    x: 0.5, y: 3.85, w: 12, h: 0.35,
    fontSize: 14, color: BRAND.green, fontFace: "Source Sans 3",
  });
  slide.addText("raimzeal.com  ·  support@raimzeal.com  ·  ECONTEUR LLC  ·  June 2026", {
    x: 0.5, y: 6.9, w: 12, h: 0.25,
    fontSize: 9, color: BRAND.muted, fontFace: "Source Sans 3",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GUIDE 1: USER GUIDE
// ─────────────────────────────────────────────────────────────────────────────
function buildUserGuide() {
  const prs = newDeck("User Guide");
  const fp = (n: number) => `${n} / 20`;

  titleSlide(prs, "User Guide", "Everything you need to get started and get the most from RAIMZEAL");

  sectionTitle(prs, "1", "Welcome to RAIMZEAL", fp(2));
  contentSlide(prs, "1. Welcome to RAIMZEAL", [
    { text: "Free forever — no subscriptions, no ads, no paywalls. Ever.", sub: "RAIMZEAL operates as a non-profit initiative under ECONTEUR LLC. All features are available to every user at zero cost." },
    { text: "Six health disciplines in one app", sub: "Fitness · Food Therapy · Mental Wellness · Community · Sleep & Recovery · Preventive Care" },
    { text: "Available on iOS, Android, and web", sub: "Your health data syncs automatically across all devices when you are signed in." },
    { text: "Built by Dr. Ephraim Oviawe and ECONTEUR LLC", sub: "Founded on the conviction that every person — regardless of income, location, or insurance — deserves evidence-based health guidance." },
    { text: "No clinical data is sold, shared, or used for advertising — ever." },
  ], fp(3));

  sectionTitle(prs, "2", "Getting Started", fp(4));
  contentSlide(prs, "2.1  Creating Your Account", [
    { text: "Step 1 — Download RAIMZEAL", sub: "App Store (iOS) · Google Play (Android) · Web app at raimzeal.com" },
    { text: "Step 2 — Tap Get Started on the welcome screen" },
    { text: "Step 3 — Choose your sign-in method (see next slide)" },
    { text: "Step 4 — Complete your 3-minute health profile", sub: "Age · Biological sex · Height · Weight · Goals · Activity level · Dietary preferences · Health conditions (optional) · Cultural background" },
    { text: "Step 5 — Your personalised dashboard is ready" },
  ], fp(5));
  twoColSlide(prs, "2.2  Sign-In Options",
    [
      { title: "Sign in with Apple", body: "Use your Apple ID. Option to hide your real email using Apple's relay. Most private option available." },
      { title: "Email & Password", body: "Any email + password of your choice. Verification email sent. Password never stored in plain text." },
    ],
    [
      { title: "Sign in with Google", body: "Use your Google account. RAIMZEAL only requests your name and email — no access to Gmail, Drive, or other services." },
      { title: "Guest / Anonymous Mode", body: "Browse without an account. Data stored locally. Upgrade to a full account at any time without losing data." },
    ], fp(6));

  sectionTitle(prs, "3–5", "Health Features", fp(7));
  twoColSlide(prs, "3. Your Health Dashboard",
    [
      { title: "Daily Ring", body: "Visual summary of activity, nutrition, sleep, and mental wellness for today." },
      { title: "Streaks", body: "Track consistency across programs. Streaks reset at midnight in your local timezone." },
    ],
    [
      { title: "Next Action", body: "AI picks the single most impactful action for you today based on your history." },
      { title: "Weekly Summary", body: "Every Sunday: a personal health summary with insights and suggestions." },
    ], fp(8));
  contentSlide(prs, "4. Fitness Programs", [
    { text: "Browse by goal — strength, cardio, flexibility, weight loss, athletic performance", sub: "Or let RAIMZEAL recommend one based on your profile" },
    { text: "Each program shows: Duration · Difficulty · Equipment needed · Session time · Community rating" },
    { text: "Guided workouts — animated demonstrations, rep counts, rest timers, form cues" },
    { text: "Adaptive difficulty — RAIMZEAL adjusts intensity automatically as you progress" },
    { text: "No gym required — all programs include home-friendly options" },
    { text: "Fitness History — workout frequency, volume, cardio distance, personal records" },
  ], fp(9));
  contentSlide(prs, "5. Food Therapy", [
    { text: "AI Meal Planning — personalised weekly meal plans including full recipes, nutritional breakdown, prep time, allergen substitutions, cultural variants" },
    { text: "Cultural food variants — West African, Caribbean, South Asian, Mediterranean, and more" },
    { text: "Food Logging — search 500,000+ items, scan barcodes, or photograph meals (AI image recognition)" },
    { text: "Food as Medicine library — connects specific foods to health conditions with peer-reviewed citations", sub: "High blood pressure · Type 2 diabetes · Inflammatory conditions · and more" },
    { text: "Tap the refresh icon on any meal to get a personalised alternative instantly" },
  ], fp(10));

  sectionTitle(prs, "6–9", "Wellness & Preventive", fp(11));
  contentSlide(prs, "6. Mental Wellness", [
    { text: "Daily Mood Check-In — 1-minute log identifying patterns across days, foods, activities, sleep" },
    { text: "AI-Guided Reflections — CBT, mindfulness, positive psychology techniques (5–10 min)" },
    { text: "Stress Management Library — breathing exercises, progressive muscle relaxation, grounding, sleep preparation — all available offline" },
    { text: "Crisis Resources — 988 Suicide & Crisis Lifeline (US) and country-specific emergency resources always accessible", sub: "RAIMZEAL is a wellness tool — not a crisis service. In a mental health emergency, contact emergency services." },
  ], fp(12));
  contentSlide(prs, "7–8. Community & Sleep", [
    { text: "Community — post updates, share achievements, ask questions, motivate each other", sub: "Posts can be public or followers-only · Automated moderation + user reporting" },
    { text: "Community Guidelines — be kind · no medical advice · no spam · no body shaming", sub: "Moderators review all reports within 24 hours" },
    { text: "Sleep Logging — bedtime, wake time, quality rating. Under 30 seconds each morning." },
    { text: "Sleep Score — based on duration, consistency, and self-reported quality" },
    { text: "Circadian Guidance — bedtime, morning light, evening wind-down based on your chronotype" },
    { text: "Recovery Protocols — after intense workouts: sleep duration, hydration, nutrition, active recovery" },
  ], fp(13));
  contentSlide(prs, "9. Preventive Health", [
    { text: "Health Risk Assessment — 10-min questionnaire covering family history, lifestyle, symptoms", sub: "Generates personalised risk profile across cardiovascular disease, Type 2 diabetes, certain cancers, hypertension" },
    { text: "Screening Reminders — based on age, sex, risk profile following USPSTF guidelines", sub: "Blood pressure · Cholesterol · Cancer screenings · Dental · Vision" },
    { text: "Symptom Tracker — log recurring symptoms; RAIMZEAL tracks patterns and suggests when to see a provider" },
    { text: "DISCLAIMER: All Preventive Health tools are educational and informational. They do not constitute medical advice, diagnosis, or treatment. Always consult a licensed healthcare provider for medical decisions." },
  ], fp(14));

  sectionTitle(prs, "10", "Privacy & Your Data", fp(15));
  contentSlide(prs, "10. Privacy — What We Collect", [
    { text: "Account information — email or OAuth token, display name" },
    { text: "Health profile data you enter — age, goals, dietary preferences" },
    { text: "Activity logs you create — workouts, meals, mood check-ins, sleep logs" },
    { text: "App usage data — screens visited, features used — anonymised and aggregated" },
  ], fp(16));
  contentSlide(prs, "10. Privacy — What We Never Do & Your Rights", [
    { text: "NEVER sell your data to any third party" },
    { text: "NEVER use your data for advertising" },
    { text: "NEVER share individually identifiable health data with insurers, employers, or government (except legally required)" },
    { text: "NEVER store payment information — RAIMZEAL is free, no payments are ever processed" },
    { text: "EXPORT — request a full data export at any time from Settings → Privacy → Export My Data" },
    { text: "DELETE — permanent account + data deletion from Settings → Privacy → Delete Account (completes within 30 days)" },
    { text: "Data encrypted at rest and in transit. Supabase PostgreSQL with Row Level Security." },
  ], fp(17));

  sectionTitle(prs, "11", "Troubleshooting & Support", fp(18));
  contentSlide(prs, "11. Common Issues", [
    { text: "Can't sign in — use the same method you used to create your account", sub: "Apple Sign In users must sign in with Apple. Email accounts use Forgot Password." },
    { text: "Data didn't sync — pull down on dashboard to force manual sync. Sign out and back in for full re-sync." },
    { text: "Workout video won't load — move to a better network connection or use text-only mode toggle" },
    { text: "Meal plan doesn't match preferences — revisit Settings → My Profile → Dietary Preferences, then regenerate plan" },
    { text: "Found a bug — Settings → Help → Report a Bug. RAIMZEAL reviews all reports with weekly releases." },
    { text: "Contact Support — support@raimzeal.com · Settings → Help → Contact Support · Response: within 48 hours" },
  ], fp(19));

  closingSlide(prs, "User Guide");

  const out = path.join(OUTPUT_DIR, "RAIMZEAL-User-Guide.pptx");
  prs.writeFile({ fileName: out });
  console.log(`✅  User Guide → ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GUIDE 2: DEVELOPER GUIDE
// ─────────────────────────────────────────────────────────────────────────────
function buildDeveloperGuide() {
  const prs = newDeck("Developer Guide");
  const fp = (n: number) => `${n} / 22`;

  titleSlide(prs, "Developer Guide", "Technical reference for engineers building on or contributing to RAIMZEAL");

  sectionTitle(prs, "1", "Architecture Overview", fp(2));
  contentSlide(prs, "1.1  Monorepo Structure", [
    { text: "artifacts/api-server — Express 5 REST API", sub: "All server-side logic, Drizzle ORM, Supabase integration" },
    { text: "artifacts/raimzeal — React + Vite web app", sub: "Client-side web app, served at /" },
    { text: "artifacts/raimzeal-mobile — Expo SDK 54 mobile app", sub: "iOS + Android. File-based routing via expo-router v4" },
    { text: "lib/db — Drizzle ORM schema + Supabase client", sub: "Shared database layer consumed by api-server" },
    { text: "lib/api-spec — OpenAPI 3.1 spec + Orval codegen outputs", sub: "Source of truth for all API contracts. Generates React Query hooks + Zod schemas." },
    { text: "scripts/ — Shared utility scripts (sync-github, seed, etc.)" },
  ], fp(3));
  tableSlide(prs, "1.2  Service Map",
    ["Service", "Package", "Path", "Tech Stack"],
    [
      ["REST API", "@workspace/api-server", "/api", "Express 5, Drizzle ORM, Pino logging"],
      ["Web App", "@workspace/raimzeal", "/", "React, Vite, TailwindCSS, Wouter"],
      ["Mobile App", "@workspace/raimzeal-mobile", "Expo dev server", "Expo SDK 54, React Native, NativeWind"],
      ["Database", "@workspace/db", "Supabase (cloud)", "PostgreSQL, Drizzle ORM, Row Level Security"],
      ["API Spec", "@workspace/api-spec", "—", "OpenAPI 3.1, Orval codegen"],
    ], fp(4));
  contentSlide(prs, "1.3  Data Flow", [
    { text: "All client-server communication goes through the REST API" },
    { text: "Web + mobile both use React Query hooks generated by Orval from the OpenAPI spec" },
    { text: "Auth — Supabase client SDK issues JWTs; API server validates against Supabase JWKS endpoint" },
    { text: "Database — Drizzle ORM queries Supabase PostgreSQL via the service role key (server-only)" },
    { text: "Client always uses the anon key — never the service role key" },
    { text: "Flow: Client → Auth (Supabase JWT) → /api/* → requireAuth middleware → Drizzle → Supabase PostgreSQL" },
  ], fp(5));

  sectionTitle(prs, "2", "Prerequisites & Setup", fp(6));
  contentSlide(prs, "2.1  Required Tools & Environment Variables", [
    { text: "Node.js 20+ (LTS) · pnpm 9+ · EAS CLI: npm install -g eas-cli · Git" },
    { text: "SUPABASE_URL — all services", sub: "Your Supabase project URL" },
    { text: "SUPABASE_ANON_KEY — API, mobile, web", sub: "Public anon key — safe for clients" },
    { text: "SUPABASE_SERVICE_ROLE_KEY — API server only", sub: "Never expose to any client" },
    { text: "OPENAI_API_KEY — API server only", sub: "Powers meal plan + fitness AI generation" },
    { text: "DATABASE_URL — API server (migrations)", sub: "PostgreSQL connection string for Drizzle" },
    { text: "EXPO_TOKEN — EAS builds only", sub: "EAS project access token" },
  ], fp(7));
  contentSlide(prs, "2.2  First-Time Setup", [
    { text: "Clone the repo and enter the workspace directory" },
    { text: "pnpm install — installs all workspace dependencies" },
    { text: "pnpm --filter @workspace/api-server run db:migrate — applies database migrations" },
    { text: "pnpm run typecheck — runs full TypeScript check across all packages" },
    { text: "pnpm --filter @workspace/api-spec run codegen — regenerates API client after spec changes" },
    { text: "Each artifact has its own workflow on Replit — do NOT run pnpm dev at the workspace root" },
  ], fp(8));

  sectionTitle(prs, "3", "Running the Project", fp(9));
  contentSlide(prs, "3. Running Individual Services", [
    { text: "API server — pnpm --filter @workspace/api-server run dev" },
    { text: "Web app — pnpm --filter @workspace/raimzeal run dev" },
    { text: "Mobile app — pnpm --filter @workspace/raimzeal-mobile run dev" },
    { text: "Full typecheck — pnpm run typecheck" },
    { text: "Lib typecheck — pnpm run typecheck:libs (run after changing lib/ packages)" },
    { text: "Codegen — pnpm --filter @workspace/api-spec run codegen (run after changing openapi.yaml)" },
    { text: "On Replit — restart workflows from the Replit UI instead of running pnpm dev" },
  ], fp(10));

  sectionTitle(prs, "4", "API Reference", fp(11));
  contentSlide(prs, "4.1  Authentication", [
    { text: "All authenticated endpoints require: Authorization: Bearer <supabase-jwt>" },
    { text: "JWT validated against Supabase JWKS endpoint by requireAuth middleware" },
    { text: "Unauthenticated requests to protected routes → 401 Unauthorized" },
    { text: "Public endpoints (no auth): GET /api/healthz" },
    { text: "Never log or expose JWTs in server code — use req.log for server logging" },
  ], fp(12));
  tableSlide(prs, "4.2  Core API Endpoints",
    ["Method", "Endpoint", "Auth", "Description"],
    [
      ["GET", "/api/healthz", "Public", "Health check — returns 200 OK with server status"],
      ["GET", "/api/users/me", "Required", "Returns authenticated user's profile and preferences"],
      ["POST", "/api/meal-plans/generate", "Required", "Generates personalised weekly meal plan (OpenAI)"],
      ["GET", "/api/fitness/programs", "Required", "Returns programs filtered by user's profile and goals"],
      ["POST", "/api/community/posts", "Required", "Creates a community post {content, type, visibility}"],
      ["POST", "/api/health-logs", "Required", "Logs a health event (workout, meal, mood, sleep)"],
    ], fp(13));

  sectionTitle(prs, "5", "Database", fp(14));
  tableSlide(prs, "5.1  Core Tables (Drizzle ORM + Supabase PostgreSQL)",
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
    ], fp(15));
  contentSlide(prs, "5.2  Migrations & Row Level Security", [
    { text: "Generate migration — pnpm --filter @workspace/api-server run db:generate" },
    { text: "Apply migrations — pnpm --filter @workspace/api-server run db:migrate" },
    { text: "Open Drizzle Studio — pnpm --filter @workspace/api-server run db:studio" },
    { text: "All production tables have Row Level Security (RLS) enabled" },
    { text: "RLS — users can only read and write their own rows" },
    { text: "Service role key bypasses RLS — NEVER expose to client code" },
    { text: "Always use the anon key in client-side code" },
  ], fp(16));

  sectionTitle(prs, "6–7", "Auth & Mobile", fp(17));
  contentSlide(prs, "6. Authentication (Supabase Auth)", [
    { text: "Apple Sign In — configured with Apple Services ID + private key in Supabase Auth settings", sub: "Required for iOS (App Store Guideline 4.8). Uses expo-apple-authentication on native." },
    { text: "Google OAuth — configured with Google Cloud OAuth client in Supabase Auth settings", sub: "Uses expo-auth-session on mobile (NOT @react-native-google-signin — incompatible with Expo managed)" },
    { text: "Email/password — enabled with mandatory email verification" },
    { text: "Anonymous sign-in — enabled for guest mode" },
    { text: "iOS Bundle ID: app.replit.raimzeal — DO NOT CHANGE" },
    { text: "Android Package: com.econteur.raimzeal — DO NOT CHANGE" },
  ], fp(18));
  contentSlide(prs, "7. Mobile App (Expo SDK 54)", [
    { text: "Key packages: expo-router v4 · @supabase/supabase-js · expo-apple-authentication · expo-auth-session · @tanstack/react-query · nativewind · expo-camera" },
    { text: "EAS Build — Development: eas build --profile development --platform ios" },
    { text: "EAS Build — Preview (TestFlight): eas build --profile preview --platform ios" },
    { text: "EAS Build — Production (App Store): eas build --profile production --platform ios" },
    { text: "EAS Submit — App Store: eas submit --platform ios --latest" },
    { text: "Permissions: Camera · Microphone (fitness audio) · Location (optional) · Activity Recognition (Android)" },
    { text: "iOS 16+ · Android targetSdk 35 (Android 10+ minimum)" },
  ], fp(19));

  sectionTitle(prs, "8–9", "Deploy & Contribute", fp(20));
  contentSlide(prs, "8. Deployment", [
    { text: "API + Web — deployed to Replit Autoscale via Replit deployment system" },
    { text: "Production URL — raimzeal.com (.replit.app domain or custom domain)" },
    { text: "Healthcheck — /api/healthz polled to confirm deployment is live" },
    { text: "Environment variables — set separately in Replit deployment environment" },
    { text: "iOS/Android — EAS build must be run from a local machine (Replit blocks git commands needed by EAS)", sub: "eas build → eas submit → App Store Connect review → Live" },
    { text: "Deployment cost: ~$19/month (Replit Starter plan)" },
  ], fp(21));
  contentSlide(prs, "9. Contributing Standards", [
    { text: "Branches — main (always deployable) · feature/<desc> · fix/<desc>" },
    { text: "TypeScript strict mode — no any types permitted" },
    { text: "No console.log in server code — use req.log (route handlers) or singleton logger" },
    { text: "API changes — update OpenAPI spec first, then run codegen" },
    { text: "Database changes — must include a Drizzle migration" },
    { text: "All new routes must use requireAuth middleware unless explicitly public" },
    { text: "Pre-commit: pnpm run typecheck (zero errors required) · pnpm run typecheck:libs (if lib/ changed) · codegen (if openapi.yaml changed)" },
  ], fp(22));

  closingSlide(prs, "Developer Guide");

  const out = path.join(OUTPUT_DIR, "RAIMZEAL-Developer-Guide.pptx");
  prs.writeFile({ fileName: out });
  console.log(`✅  Developer Guide → ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GUIDE 3: OPERATIONS GUIDE
// ─────────────────────────────────────────────────────────────────────────────
function buildOperationsGuide() {
  const prs = newDeck("Operations Guide");
  const fp = (n: number) => `${n} / 24`;

  titleSlide(prs, "Operations Guide", "Platform status · costs · maintenance · grant strategy · 501(c)(3) setup · scaling plan");

  sectionTitle(prs, "1", "Platform Status — June 2026", fp(2));
  twoColSlide(prs, "1. Platform Status — June 2026",
    [
      { title: "API Server — OPERATIONAL", body: "Running on Replit Autoscale. Healthcheck: /api/healthz. Monitored every 5 minutes." },
      { title: "Web App — OPERATIONAL", body: "Deployed at raimzeal.com. Row Level Security enabled. All tables secured." },
      { title: "Supabase Database — OPERATIONAL", body: "Free tier. 500MB storage. Row Level Security on all tables." },
    ],
    [
      { title: "iOS App Store — SUBMISSION IN PROGRESS", body: "Compliance audit complete. Apple Sign In approved. Awaiting App Store review." },
      { title: "Android Google Play — PLANNED Q3 2026", body: "EAS Android build ready. Google Play Developer account setup pending." },
      { title: "Version — v1.3.0", body: "June 2026. iOS Bundle: app.replit.raimzeal. Android: com.econteur.raimzeal." },
    ], fp(3));

  sectionTitle(prs, "2", "Infrastructure & Monthly Costs", fp(4));
  tableSlide(prs, "2.1  Monthly Cost Breakdown",
    ["Service", "Plan", "Monthly", "Annual", "Notes"],
    [
      ["Replit", "Starter", "$19.00", "$228.00", "API server + web app + all artifacts"],
      ["EAS (Expo Application Services)", "Starter", "$19.00", "$228.00", "Mobile builds — iOS + Android"],
      ["Apple Developer Program", "Individual", "~$8.25", "$99.00", "Billed annually. Required for App Store."],
      ["Supabase", "Free", "$0.00", "$0.00", "Free up to 50,000 MAU, 500MB storage"],
      ["Domain (raimzeal.com)", "Annual", "~$1.50", "~$18.00", "Domain registrar"],
      ["OpenAI API", "Pay-as-you-go", "~$3.00", "~$36.00", "Scales with usage volume"],
      ["TOTAL", "—", "~$50.75", "~$609.00", "Supports up to 50,000 MAU at this cost"],
    ], fp(5));
  tableSlide(prs, "2.2  Grant Runway Analysis",
    ["Grant Size", "Runway at $609/yr", "Source Example"],
    [
      ["$10,000", "16 years", "Small health foundation grant"],
      ["$50,000", "82 years", "NIH supplemental or community health grant"],
      ["$250,000", "410 years", "Gates Foundation / major health-focused donor"],
      ["$500,000", "820 years", "Mid-size institutional grant"],
      ["$1,000,000", "1,642 years", "Major institutional grant (NIH, CDC, RWJF)"],
    ], fp(6));

  sectionTitle(prs, "3", "Maintenance Schedule", fp(7));
  contentSlide(prs, "3. Maintenance Schedule", [
    { text: "DAILY (5 min) — Check Replit deployment healthcheck · Review bug reports · Check Supabase auth alerts" },
    { text: "WEEKLY (30 min) — Community moderation queue · OpenAI usage dashboard · Supabase query performance · Check pnpm outdated · Review Expo + EAS release notes" },
    { text: "MONTHLY (2–3 hr) — Apply security dependency updates + run typechecks · Review Supabase RLS policies · Review USPSTF screening guidelines · App analytics review · Invoice review · Back up OpenAPI spec + DB schema" },
    { text: "ANNUALLY — Renew Apple Developer Program ($99) · Renew domain · Review privacy policy (HIPAA, GDPR, CCPA) · Full security audit (dependency, SAST, hound-dog)" },
  ], fp(8));

  sectionTitle(prs, "4", "Monitoring & Alerts", fp(9));
  contentSlide(prs, "4. Monitoring & Setting Up Uptime Alerts", [
    { text: "Healthcheck endpoint — GET /api/healthz returns HTTP 200 when API + DB are healthy" },
    { text: "Manual check — curl -sf https://raimzeal.com/api/healthz && echo 'API healthy'" },
    { text: "Supabase — app.supabase.com → Logs → API logs · Database → Query Performance · Auth → Users" },
    { text: "Free uptime monitoring (UptimeRobot / Better Uptime / Freshping) — recommended" },
    { text: "Setup: Create free account → Add HTTP(s) monitor → URL: https://raimzeal.com/api/healthz → Interval: 5 min → Add email alert → Save" },
    { text: "Supabase free tier storage limit: 500MB. Migrate to Supabase Pro ($25/mo) when approaching 400MB." },
  ], fp(10));

  sectionTitle(prs, "5", "App Store Management", fp(11));
  contentSlide(prs, "5.1  iOS App Store Updates", [
    { text: "Step 1 — Make code changes and test on simulator or TestFlight" },
    { text: "Step 2 — Bump version + ios.buildNumber in app.json" },
    { text: "Step 3 — Build (from local machine, not Replit): eas build --profile production --platform ios" },
    { text: "Step 4 — Submit: eas submit --platform ios --latest" },
    { text: "Step 5 — Complete App Store Connect submission metadata" },
    { text: "Step 6 — Submit for review. First submissions: 24–72 hrs. Updates: usually faster." },
    { text: "Key: iOS Bundle ID = app.replit.raimzeal · Apple Team ID in EAS credentials — DO NOT MODIFY" },
  ], fp(12));
  contentSlide(prs, "5.2  Android Google Play (Planned Q3 2026)", [
    { text: "Step 1 — Create Google Play Developer account ($25 one-time fee)" },
    { text: "Step 2 — Build: eas build --profile production --platform android" },
    { text: "Step 3 — Submit: eas submit --platform android --latest" },
    { text: "Step 4 — Complete Play Store listing (description, screenshots, privacy policy URL, data safety form)" },
    { text: "Step 5 — Initial review: 3–7 business days for new apps" },
    { text: "Android package name: com.econteur.raimzeal — DO NOT CHANGE" },
  ], fp(13));

  sectionTitle(prs, "6", "Investor & Grant Strategy", fp(14));
  contentSlide(prs, "6.1  Priority Grant Sources", [
    { text: "NIH SBIR Phase I — up to $300K", sub: "6-month feasibility study. Food Therapy AI and preventive health modules are strong fits. grants.nih.gov/grants/funding/sbir.htm · ongoing" },
    { text: "Robert Wood Johnson Foundation — $50K–$500K", sub: "Health equity focus. RAIMZEAL's free access + culturally adaptive nutrition = direct alignment. rwjf.org · targeted RFPs" },
    { text: "Gates Foundation — $100K–$2M", sub: "Global health / low- and middle-income countries. Smartphone-first, free, culturally adaptable. Unsolicited proposals accepted." },
    { text: "CDC Prevention Research Centers — $100K–$1M", sub: "Community-based health promotion. Annual RFA cycle (typically August). cdc.gov/prc" },
    { text: "Apple App Store Small Business Program — developer support + marketing", sub: "Marketing opportunities and access to Apple Health partnerships. Apply after app goes live." },
  ], fp(15));
  contentSlide(prs, "6.2  Institutional Partnership Strategy", [
    { text: "Hospital systems — free patient wellness tool. Hospitals benefit from patient engagement + readmission reduction." },
    { text: "HBCUs and minority-serving universities — student wellness programs. Free campus license; institutions provide research access." },
    { text: "FQHCs (Federally Qualified Health Centers) — serve underserved populations; RAIMZEAL aligns with their mission." },
    { text: "Corporate wellness programs — employers offer RAIMZEAL free to employees; RAIMZEAL gains users + grant credibility." },
  ], fp(16));
  tableSlide(prs, "6.3  Grant Application Timeline",
    ["Milestone", "Target", "Notes"],
    [
      ["iOS live on App Store", "Q2 2026", "Required for most grant applications"],
      ["501(c)(3) application filed", "Q3 2026", "Required for most foundation grants"],
      ["First NIH SBIR submission", "Q3 2026", "Requires 501(c)(3) or SBIR-eligible entity"],
      ["RWJF letter of inquiry", "Q4 2026", "After first 10,000 users achieved"],
      ["Gates Foundation proposal", "H1 2027", "Requires demonstrated user growth + outcomes data"],
    ], fp(17));

  sectionTitle(prs, "7", "501(c)(3) Foundation Setup", fp(18));
  contentSlide(prs, "7.1  Recommended Approach — File a New 501(c)(3)", [
    { text: "Incorporate a new non-profit corporation (e.g. RAIMZEAL Health Foundation) in your state" },
    { text: "ECONTEUR LLC licenses the RAIMZEAL platform to the foundation for $0/year" },
    { text: "Foundation holds all grant revenue and mission commitments" },
    { text: "ECONTEUR LLC can remain as technology developer under a service agreement" },
    { text: "Estimated cost: $300–$1,000 state filing fees + $275 IRS 1023-EZ fee (or $600 for full 1023)" },
    { text: "Timeline: approximately 2–3 months using Form 1023-EZ" },
  ], fp(19));
  contentSlide(prs, "7.2  501(c)(3) Step-by-Step Process", [
    { text: "Step 1 — Choose incorporation state (Delaware most common; home state also fine)" },
    { text: "Step 2 — Draft Articles of Incorporation (purpose statement, dissolution clause, no private inurement)" },
    { text: "Step 3 — Appoint Board of Directors (minimum 3; at least 1 independent member)" },
    { text: "Step 4 — File Articles with Secretary of State ($50–$200; 1–4 weeks processing)" },
    { text: "Step 5 — Obtain EIN from IRS (free, same day at irs.gov)" },
    { text: "Step 6 — Draft bylaws + conflict of interest policy (required by IRS)" },
    { text: "Step 7 — File IRS Form 1023-EZ ($275, 2–6 weeks) or Form 1023 ($600, 3–6 months)" },
    { text: "Step 8 — Register for charitable solicitation in your state" },
    { text: "Step 9 — Open non-profit bank account" },
    { text: "Step 10 — Execute platform license agreement (ECONTEUR LLC → Foundation at $0/year)" },
  ], fp(20));
  contentSlide(prs, "7.3  Required Document Checklist", [
    { text: "☐  Articles of Incorporation (filed and stamped by Secretary of State)" },
    { text: "☐  Federal EIN confirmation letter (IRS SS-4)" },
    { text: "☐  Organizational bylaws" },
    { text: "☐  Conflict of interest policy" },
    { text: "☐  IRS Form 1023 or 1023-EZ application" },
    { text: "☐  IRS determination letter (tax-exempt status confirmation)" },
    { text: "☐  State charitable solicitation registration (if applicable)" },
    { text: "☐  Board meeting minutes from organizational meeting" },
    { text: "☐  Non-profit bank account setup" },
    { text: "☐  Platform license agreement (ECONTEUR LLC → Foundation)" },
  ], fp(21));

  sectionTitle(prs, "8–9", "Incident Response & Scaling", fp(22));
  contentSlide(prs, "8. Incident Response", [
    { text: "API OUTAGE — Check Replit deployment → restart if down → check recent deploys → check Supabase status → review server logs → post status update if >30 min" },
    { text: "DATA BREACH — Rotate all Supabase API keys → disable anon key + generate new → assess scope → notify affected users within 72 hrs (GDPR) / 60 days (HIPAA) → file FTC report if >500 state residents affected" },
    { text: "INAPPROPRIATE CONTENT — Report reviewed within 24 hrs → content violating guidelines: delete + warn → repeated violations: restrict account → illegal content: report to NCMEC/FBI + preserve evidence + permanent ban" },
  ], fp(23));
  contentSlide(prs, "9. Scaling Plan", [
    { text: "0–50,000 MAU — Current setup: ~$51/month. No changes needed. Supabase free tier covers this range." },
    { text: "50K–500K MAU — ~$100–$200/month. Supabase Pro ($25/mo, 100K MAU) + Replit Autoscale compute + OpenAI response caching." },
    { text: "500K–5M MAU — ~$500–$2,000/month. Supabase Team ($599/mo) + dedicated cloud API server (AWS/GCP/Fly.io) + Redis caching + Cloudflare CDN free tier + apply for AWS Nonprofit Credits ($2,000/yr)" },
    { text: "5M+ MAU — Hire 1+ full-time platform engineer (grant-funded) + horizontal scaling + formal SRE practice + WHO partnership support" },
    { text: "Supabase free tier supports 50,000 MAU with zero incremental cost — very generous for early growth" },
  ], fp(24));

  closingSlide(prs, "Operations Guide");

  const out = path.join(OUTPUT_DIR, "RAIMZEAL-Operations-Guide.pptx");
  prs.writeFile({ fileName: out });
  console.log(`✅  Operations Guide → ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN ALL
// ─────────────────────────────────────────────────────────────────────────────
console.log("Generating RAIMZEAL Documentation PowerPoint files...\n");
buildUserGuide();
buildDeveloperGuide();
buildOperationsGuide();
console.log("\nAll 3 PPTX files generated.");
