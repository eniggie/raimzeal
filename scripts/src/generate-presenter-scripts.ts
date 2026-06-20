import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = require("pdfkit") as any;
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(process.cwd(), ".local", "outputs");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const C = {
  bg:      "#0D0D0D",
  surface: "#1A1A1A",
  gold:    "#C8A84B",
  green:   "#2D8C4E",
  white:   "#F0EDE8",
  muted:   "#888888",
  border:  "#2A2A2A",
};

function newDoc(title: string): any {
  return new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 60, right: 60 },
    info: {
      Title: `RAIMZEAL – ${title}`,
      Author: "Dr. Ephraim Oviawe – ECONTEUR LLC",
      Subject: title,
    },
    autoFirstPage: false,
  });
}

const W = (d: any) => d.page.width;
const H = (d: any) => d.page.height;
const ML = (d: any) => d.page.margins.left;
const MR = (d: any) => d.page.margins.right;
const TW = (d: any) => W(d) - ML(d) - MR(d);

function bgFill(doc: any) { doc.rect(0, 0, W(doc), H(doc)).fill(C.bg); }
function topBar(doc: any) { doc.rect(0, 0, W(doc), 3).fill(C.gold); }
function footer(doc: any, label: string, n: number) {
  const y = H(doc) - 32;
  doc.rect(0, y - 3, W(doc), 1).fill(C.border);
  doc.fillColor(C.muted).fontSize(7).font("Helvetica")
    .text(label, ML(doc), y, { width: TW(doc) - 50 })
    .text(String(n), ML(doc), y, { width: TW(doc), align: "right" });
}

function coverPage(doc: any, num: string, title: string, subtitle: string, duration: string) {
  doc.addPage();
  bgFill(doc);
  doc.rect(0, 0, 5, H(doc)).fill(C.gold);
  // Script badge
  doc.rect(ML(doc) + 8, 60, 130, 22).fill(C.surface);
  doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(8)
    .text("AI PRESENTER SCRIPT", ML(doc) + 16, 67);
  // Number
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(80)
    .text(num, ML(doc) + 8, 90, { width: TW(doc) });
  // Title
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(30)
    .text(title, ML(doc) + 8, 192, { width: TW(doc), lineGap: 3 });
  // Subtitle
  doc.fillColor(C.muted).font("Helvetica").fontSize(12)
    .text(subtitle, ML(doc) + 8, 252, { width: TW(doc), lineGap: 4 });
  // Divider
  doc.rect(ML(doc) + 8, 308, 100, 2).fill(C.green);
  // Meta row
  doc.fillColor(C.muted).font("Helvetica").fontSize(9)
    .text(`Approx. duration: ${duration}  ·  ECONTEUR LLC / Dr. Ephraim Oviawe  ·  RAIMZEAL v1.3.0  ·  June 2026`, ML(doc) + 8, 318);
  // Synthesia note box
  doc.rect(ML(doc) + 8, 350, TW(doc) - 8, 110).fill(C.surface);
  doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(9)
    .text("HOW TO USE THIS SCRIPT IN SYNTHESIA / HEYGEN", ML(doc) + 20, 362);
  doc.fillColor(C.white).font("Helvetica").fontSize(8.5)
    .text(
      "1. Create a new project in Synthesia (synthesia.io) or HeyGen (heygen.com).\n" +
      "2. Choose your AI avatar — a professional presenter, ideally diverse/inclusive to match RAIMZEAL's mission.\n" +
      "3. Paste each [SEGMENT] of script below into its own scene (Synthesia) or slide (HeyGen).\n" +
      "4. Use the [VISUAL CUE] notes to set the background, B-roll, or on-screen graphics for each segment.\n" +
      "5. Add RAIMZEAL logo as a watermark and set brand colors (#C8A84B gold, #2D8C4E green, #0D0D0D background).\n" +
      "6. Review auto-generated captions — correct any RAIMZEAL, Oviawe, or ECONTEUR pronunciation.\n" +
      "7. Export at 1080p. Add music: calm, hopeful background track at ~15% volume.",
      ML(doc) + 20, 376, { width: TW(doc) - 28, lineGap: 3 });
}

interface Segment {
  label: string;
  visual: string;
  script: string;
  duration: string;
}

function scriptPage(doc: any, segments: Segment[], pageStart: number): number {
  let p = pageStart;
  for (let i = 0; i < segments.length; i += 2) {
    doc.addPage();
    bgFill(doc);
    topBar(doc);
    let y = 18;
    for (let j = i; j < Math.min(i + 2, segments.length); j++) {
      const seg = segments[j];
      // Segment header bar
      doc.rect(ML(doc), y, TW(doc), 20).fill(C.surface);
      doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(9)
        .text(`[SEGMENT ${j + 1}]  ${seg.label}`, ML(doc) + 8, y + 6, { width: TW(doc) * 0.6 });
      doc.fillColor(C.green).font("Helvetica-Bold").fontSize(8)
        .text(`~${seg.duration}`, ML(doc) + 8, y + 6, { width: TW(doc) - 16, align: "right" });
      y += 24;
      // Visual cue
      const visualLines = doc.heightOfString(`VISUAL CUE: ${seg.visual}`, { width: TW(doc) - 16, font: "Helvetica", size: 8 });
      doc.rect(ML(doc), y, TW(doc), visualLines + 10).fill("#111111");
      doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(7.5)
        .text("VISUAL CUE:", ML(doc) + 8, y + 5);
      doc.fillColor(C.muted).font("Helvetica").fontSize(8)
        .text(seg.visual, ML(doc) + 68, y + 5, { width: TW(doc) - 76 });
      y += visualLines + 14;
      // Script text
      doc.rect(ML(doc), y - 2, 3, 2).fill(C.gold);
      doc.fillColor(C.white).font("Helvetica").fontSize(10.5)
        .text(seg.script, ML(doc) + 8, y, { width: TW(doc) - 8, lineGap: 3.5 });
      const scriptHeight = doc.heightOfString(seg.script, { width: TW(doc) - 8, font: "Helvetica", size: 10.5, lineGap: 3.5 });
      y += scriptHeight + 22;
      if (j < Math.min(i + 2, segments.length) - 1) {
        doc.rect(ML(doc), y - 8, TW(doc), 1).fill(C.border);
      }
    }
    footer(doc, "RAIMZEAL AI Presenter Script – ECONTEUR LLC", p++);
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT 1: USER GUIDE
// ─────────────────────────────────────────────────────────────────────────────
const userGuideSegments: Segment[] = [
  {
    label: "HOOK – THE COST PROBLEM",
    visual: "Dark background. Text on screen: '$4.5 Trillion. The US spends $4.5 trillion on healthcare every year — and millions still can't afford a doctor's visit.' Cut to: phone in hands, app opening.",
    duration: "15s",
    script:
      "What if I told you that the most powerful health tool available today — is completely free? No subscription. No ads. No hidden fees. Ever. That's RAIMZEAL. And it's changing everything.",
  },
  {
    label: "WHAT IS RAIMZEAL",
    visual: "App logo centered. Six icons appear around it: a dumbbell, a plate, a brain, a heart, people, and a shield. Text: 'Six disciplines. One free platform.'",
    duration: "18s",
    script:
      "RAIMZEAL is a free, AI-powered health companion built for every human — regardless of income, insurance status, or where you live. It brings together six evidence-based health disciplines in one place: Fitness. Food Therapy. Mental Wellness. Community. Sleep and Recovery. And Preventive Health. All of it. Free.",
  },
  {
    label: "GETTING STARTED",
    visual: "Phone screen showing sign-in options: Apple, Google, email, and guest mode. Then a 3-step animation: Download → Profile → Dashboard.",
    duration: "14s",
    script:
      "Getting started takes about three minutes. Download RAIMZEAL from the App Store, Google Play, or visit raimzeal.com. Sign in with Apple, Google, or your email — or try it as a guest, no account required. Complete your health profile, and your personalized dashboard is ready.",
  },
  {
    label: "FITNESS",
    visual: "Person exercising at home. App screen showing workout with animated rep counter, rest timer, and form cues. Text: 'No gym required.'",
    duration: "15s",
    script:
      "RAIMZEAL's fitness programs are designed for real life. Browse by goal — strength, cardio, flexibility, or weight loss. Every workout includes guided demonstrations, rest timers, and form cues. And every program has a home-friendly version, so you never need a gym membership to get started.",
  },
  {
    label: "FOOD THERAPY",
    visual: "Colorful meal on screen. App generating a personalized meal plan — culturally diverse options shown. Nutritional breakdown animates in. Barcode scanner in use.",
    duration: "18s",
    script:
      "RAIMZEAL's Food Therapy goes beyond calorie counting. Our AI generates a personalized weekly meal plan with full recipes, nutritional breakdowns, prep times, and substitutions for any allergy or dietary preference — including West African, Caribbean, South Asian, and Mediterranean options. You can also log meals by searching, scanning a barcode, or simply photographing your plate.",
  },
  {
    label: "MENTAL WELLNESS",
    visual: "Calm, soft lighting. App showing daily mood check-in. Text appearing: 'Mindfulness. CBT. Positive psychology.' Breathing animation plays.",
    duration: "16s",
    script:
      "Mental wellness isn't a luxury — it's a fundamental part of health. RAIMZEAL's daily mood check-in tracks your emotional state over time, identifying patterns that affect your wellbeing. When you need support, evidence-based reflections — grounded in CBT, mindfulness, and positive psychology — are always available. In a crisis, we always connect you to emergency resources.",
  },
  {
    label: "SLEEP & COMMUNITY",
    visual: "Split screen: left shows sleep score and circadian graph; right shows community posts with likes and encouraging comments.",
    duration: "14s",
    script:
      "Sleep is the foundation of every health goal. RAIMZEAL tracks your sleep quality, gives you a daily sleep score, and provides personalized circadian guidance so you wake up restored. And in our Community, you'll find a supportive space to share progress, celebrate wins, and stay accountable — because health is better together.",
  },
  {
    label: "PRIVACY PROMISE",
    visual: "Dark screen. Bold white text appears word by word: 'Your data is NEVER sold. NEVER shared with advertisers. NEVER monetised.' A shield icon glows gold.",
    duration: "14s",
    script:
      "Your health data belongs to you. RAIMZEAL will never sell your information, never use it for advertising, and never share it with insurers or employers. Export your data anytime. Delete your account anytime. Your privacy is not a policy — it's a promise.",
  },
  {
    label: "CALL TO ACTION",
    visual: "RAIMZEAL logo on black background. Text fades in: 'Free. Always.' Then 'raimzeal.com' and App Store / Google Play badges.",
    duration: "12s",
    script:
      "RAIMZEAL is free. It will always be free. Because everyone deserves access to the tools that help them live a healthier, longer, better life. Download RAIMZEAL today at raimzeal.com — and take the first step.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT 2: DEVELOPER GUIDE
// ─────────────────────────────────────────────────────────────────────────────
const devGuideSegments: Segment[] = [
  {
    label: "HOOK – OPEN SOURCE HEALTH INFRASTRUCTURE",
    visual: "Dark terminal window. Code scrolling. Text animates in: 'The most cost-efficient health platform ever built. Open. TypeScript. Evidence-based.'",
    duration: "12s",
    script:
      "What does open-source health infrastructure look like in 2026? It looks like RAIMZEAL. A TypeScript monorepo. A contract-first API. A free platform for fifty thousand users running on fifty dollars a month. Here's how it's built.",
  },
  {
    label: "ARCHITECTURE OVERVIEW",
    visual: "Animated diagram: monorepo boxes labeled api-server, raimzeal (web), raimzeal-mobile, lib/db, lib/api-spec. Arrows connect them. pnpm logo visible.",
    duration: "18s",
    script:
      "RAIMZEAL is a pnpm workspace monorepo. The API server runs on Express 5 with Drizzle ORM and Pino logging. The web app is React and Vite. The mobile app is Expo SDK 54 with file-based routing via expo-router version 4. Shared libraries handle the database schema and the OpenAPI contract. Every package is TypeScript strict — no compromises.",
  },
  {
    label: "CONTRACT-FIRST API",
    visual: "openapi.yaml file on screen. Arrow to codegen command. Then generated React Query hooks and Zod schemas appear. Text: 'One spec. Two clients. Zero drift.'",
    duration: "16s",
    script:
      "API design starts with the OpenAPI 3.1 spec. Running one codegen command generates React Query hooks used by both the web and mobile app, and Zod validation schemas used by the server. The spec is the source of truth. Clients never drift from the server. It's contract-first development done right.",
  },
  {
    label: "DATABASE – SUPABASE + DRIZZLE",
    visual: "Database schema diagram showing users, health_logs, meal_plans, community_posts tables. RLS shield icon. Migration command running in terminal.",
    duration: "16s",
    script:
      "The database is Supabase PostgreSQL, managed through Drizzle ORM. Every table has Row Level Security enabled — users can only access their own data. The service role key never leaves the server. Migrations are generated and applied through Drizzle's migration system, giving you a complete, version-controlled schema history.",
  },
  {
    label: "MOBILE – EXPO & EAS",
    visual: "iPhone and Android phone side by side. EAS build commands on screen. Apple Sign In dialog on iOS. Google OAuth on Android.",
    duration: "16s",
    script:
      "The mobile app is Expo SDK 54 with NativeWind for styling and React Query for data fetching. Authentication uses Apple Sign In on iOS via expo-apple-authentication — required by App Store guidelines — and Google OAuth via expo-auth-session on both platforms. Builds and store submissions go through Expo Application Services — EAS.",
  },
  {
    label: "CONTRIBUTING STANDARDS",
    visual: "Git branch diagram: main → feature/xyz. Terminal showing pnpm run typecheck passing zero errors. Text: 'Spec first. Types strict. No console.log.'",
    duration: "15s",
    script:
      "Contributing to RAIMZEAL follows three non-negotiable rules. First: if you change the API, update the OpenAPI spec first, then run codegen. Second: TypeScript strict mode — no any types, zero typecheck errors before any commit. Third: no console.log in server code. Use req.log in route handlers and the singleton logger everywhere else.",
  },
  {
    label: "DEPLOYMENT",
    visual: "Replit logo + deployment dashboard. EAS submit command. App Store Connect and Google Play Console icons. Healthcheck endpoint curl command returning 200 OK.",
    duration: "14s",
    script:
      "The API and web app deploy on Replit Autoscale. The healthcheck endpoint at /api/healthz confirms the deployment is live. iOS and Android builds go through EAS — build on a local machine, submit with one command, and App Store Connect handles the review. The entire stack, from code push to production, is automated.",
  },
  {
    label: "CALL TO ACTION",
    visual: "GitHub logo. RAIMZEAL logo. Text: 'Build the future of healthcare.' GitHub URL and raimzeal.com on screen.",
    duration: "10s",
    script:
      "RAIMZEAL is open. The codebase is documented. The architecture is modern. If you build tools that help people — this is the codebase for you. Fork it. Contribute. Help build the future of free, open healthcare.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT 3: OPERATIONS GUIDE
// ─────────────────────────────────────────────────────────────────────────────
const opsGuideSegments: Segment[] = [
  {
    label: "HOOK – THE COST REVELATION",
    visual: "Black screen. Large number appears: '$50.75'. Text below: 'Per month. 50,000 users. Zero ads. Zero paywalls.' RAIMZEAL logo fades in.",
    duration: "14s",
    script:
      "Fifty dollars and seventy-five cents. That is the total monthly cost to run RAIMZEAL for up to fifty thousand users. No venture capital. No subscription revenue. No compromises on the mission. This is what it looks like to run the most cost-efficient health platform on earth.",
  },
  {
    label: "COST BREAKDOWN",
    visual: "Animated cost table: Replit $19 · EAS $19 · Apple Developer $8.25 · Domain $1.50 · OpenAI $3 · Supabase FREE. Total: $50.75/month.",
    duration: "18s",
    script:
      "Here's where every dollar goes. Replit for the API and web app — nineteen dollars per month. Expo Application Services for mobile builds — nineteen dollars. Apple Developer Program — about eight dollars, billed annually. The domain — under two dollars. OpenAI for meal plan generation — around three dollars. And Supabase — free. Fifty thousand users. Fifty dollars a month.",
  },
  {
    label: "GRANT RUNWAY",
    visual: "Animated bar chart: $10K grant = 16 years. $50K = 82 years. $250K = 410 years. Each bar grows dramatically as the number appears.",
    duration: "18s",
    script:
      "A single ten-thousand-dollar grant funds RAIMZEAL for sixteen years. Fifty thousand dollars funds it for eighty-two years. A quarter-million dollar grant funds it for over four hundred years. This is the power of mission-aligned technology built with cost discipline. Every grant dollar goes to impact — not infrastructure overhead.",
  },
  {
    label: "MAINTENANCE SCHEDULE",
    visual: "Calendar icons: DAILY (5 min), WEEKLY (30 min), MONTHLY (2-3 hrs), ANNUALLY. Each expands to show checklist items.",
    duration: "16s",
    script:
      "Operations is designed to be lean. Daily maintenance takes five minutes — check the healthcheck endpoint and review bug reports. Weekly is thirty minutes — community moderation and cost monitoring. Monthly is two to three hours — security updates, privacy policy review, and a new app release. Annually — renew the Apple Developer account, audit security, and review compliance. That's it.",
  },
  {
    label: "501(c)(3) FOUNDATION PATH",
    visual: "10-step process animation: Incorporate → EIN → Board → Bylaws → IRS 1023-EZ → Tax-exempt status. RAIMZEAL Health Foundation name appears.",
    duration: "18s",
    script:
      "RAIMZEAL's path to a 501(c)(3) foundation is already mapped. ECONTEUR LLC licenses the platform to the RAIMZEAL Health Foundation at zero dollars per year. The foundation files IRS Form 1023-EZ — a streamlined application that costs two hundred seventy-five dollars and takes two to six weeks to process. Once approved, RAIMZEAL is eligible for virtually every health-focused grant in the country.",
  },
  {
    label: "GRANT TARGETS",
    visual: "Three logos or placeholder tiles: NIH SBIR ($300K), Robert Wood Johnson Foundation ($500K), Gates Foundation ($2M). Timeline shows Q3 2026 → H1 2027.",
    duration: "16s",
    script:
      "The grant pipeline is specific and sequenced. NIH SBIR Phase One — up to three hundred thousand dollars — targets RAIMZEAL's Food Therapy AI module. The Robert Wood Johnson Foundation aligns with health equity. The Gates Foundation supports globally scalable, free health infrastructure. The application timeline begins in Q3 2026 once the 501(c)(3) is confirmed.",
  },
  {
    label: "INCIDENT RESPONSE & SECURITY",
    visual: "Shield icon. Three scenarios appear: API outage (green), data breach (amber), inappropriate content (blue) — each with a response protocol beside it.",
    duration: "14s",
    script:
      "RAIMZEAL takes security and user safety seriously. API outages are resolved through Replit deployment rollback and Supabase monitoring — typically within minutes. Data breach protocols include immediate key rotation, user notification within 72 hours under GDPR, and FTC reporting. Content violations are reviewed within 24 hours, with illegal content reported to appropriate authorities and accounts permanently banned.",
  },
  {
    label: "SCALING PLAN",
    visual: "Animated graph: 50K MAU at $51/month → 500K MAU at $200/month → 5M MAU at $2,000/month. Each milestone shows infrastructure change needed.",
    duration: "16s",
    script:
      "The scaling plan is fully mapped. At fifty thousand users, current infrastructure holds. At five hundred thousand, Supabase upgrades to Pro — twenty-five dollars per month. At five million, a dedicated cloud server replaces Replit, with Redis caching and a CDN. At scale, AWS nonprofit credits cover most cloud costs. The mission never changes — only the infrastructure grows.",
  },
  {
    label: "CALL TO ACTION",
    visual: "RAIMZEAL logo on black. Text fades in: 'The most cost-efficient health mission on earth.' Then: 'Partner with us. Fund the mission. raimzeal.com'",
    duration: "12s",
    script:
      "RAIMZEAL is not just a health app. It is a proof of concept — that evidence-based healthcare can reach every human on earth for fifty dollars a month. If you believe in that mission, partner with us. Fund the mission. Visit raimzeal.com.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT 4: INVESTOR PRESENTATION
// ─────────────────────────────────────────────────────────────────────────────
const investorSegments: Segment[] = [
  {
    label: "CINEMATIC OPEN – THE PROBLEM",
    visual: "Slow cinematic shot — a hospital corridor, empty chairs. Text fades in: '47 million Americans. No health insurance.' Pause. '8 billion humans. Healthcare shouldn't be a privilege.'",
    duration: "16s",
    script:
      "Forty-seven million Americans have no health insurance. Hundreds of millions more are underinsured. Around the world, the majority of humanity has never had access to personalized, evidence-based health guidance. Healthcare has never been equitably distributed. Until now.",
  },
  {
    label: "THE MISSION",
    visual: "RAIMZEAL logo appears slowly. Text: 'Evidence-based healthcare for every human. Free. Forever.' Gold line draws under it.",
    duration: "14s",
    script:
      "RAIMZEAL exists for one reason: to give every person on earth access to the health guidance they deserve — regardless of income, insurance, or geography. Evidence-based. AI-powered. And completely free. Forever.",
  },
  {
    label: "THE SOLUTION – SIX PILLARS",
    visual: "Six icons animate in with labels: Fitness · Food Therapy · Mental Wellness · Community · Sleep & Recovery · Preventive Health. Then app screenshots of each.",
    duration: "18s",
    script:
      "RAIMZEAL is a comprehensive health platform across six evidence-based disciplines. Personalized fitness programs. AI-generated meal plans that adapt to culture and dietary needs. Daily mental wellness check-ins. Community support. Sleep science. And preventive health screening reminders — all grounded in peer-reviewed research. One platform. Six disciplines. Zero cost to the user.",
  },
  {
    label: "THE FOUNDER",
    visual: "Professional headshot or avatar of Dr. Ephraim Oviawe. Text: 'Dr. Ephraim Oviawe · Founder & Executive Director · ECONTEUR LLC'",
    duration: "16s",
    script:
      "RAIMZEAL was founded by Dr. Ephraim Oviawe and ECONTEUR LLC — with a singular conviction: that the most powerful health tools should be available to every human being, not just those who can afford a premium subscription. Dr. Oviawe built RAIMZEAL from the ground up as a non-profit mission, combining clinical knowledge with modern technology to close the healthcare access gap.",
  },
  {
    label: "TRACTION & TIMELINE",
    visual: "Timeline animation: Web app live → iOS launch Q2 2026 → Android Q3 2026 → 501(c)(3) Q3 2026 → NIH SBIR Q3 2026 → First major grant H1 2027.",
    duration: "16s",
    script:
      "RAIMZEAL is not a concept — it is live. The web app and API are deployed. The iOS app is in App Store review for Q2 2026 launch. Android follows in Q3 2026. The 501(c)(3) foundation application is on track for Q3 2026, opening access to NIH, RWJF, and Gates Foundation grant cycles. The mission is in motion.",
  },
  {
    label: "THE BUSINESS MODEL",
    visual: "Three revenue pillars appear: Grants (NIH, RWJF, Gates) · Institutional Partnerships (hospitals, universities, FQHCs) · Corporate Wellness. Text: 'Zero ads. Zero paywalls. Zero compromise.'",
    duration: "18s",
    script:
      "RAIMZEAL is sustained by grants, institutional partnerships, and corporate wellness programs — not by monetizing users. Grants from NIH, the Robert Wood Johnson Foundation, and the Gates Foundation fund development. Hospital systems and universities partner with RAIMZEAL to extend free wellness tools to their communities. Employers offer RAIMZEAL free to employees. No one pays for the app. Ever.",
  },
  {
    label: "MARKET SIZE",
    visual: "Globe animation. Text overlays: 'US Healthcare Market: $4.5 Trillion' → 'Digital Health: $660 Billion by 2025' → 'Addressable: Every human with a smartphone.'",
    duration: "14s",
    script:
      "The US healthcare market is four and a half trillion dollars. Digital health is a six hundred and sixty billion dollar global opportunity. But RAIMZEAL's addressable market is simpler than that: every human being on earth with a smartphone who deserves better health. That is eight billion people.",
  },
  {
    label: "COST EFFICIENCY",
    visual: "Side-by-side comparison: typical digital health startup cost per user ($20-$50/month) vs RAIMZEAL ($0.001/month per user at 50K MAU). '$50.75/month total infrastructure.'",
    duration: "16s",
    script:
      "RAIMZEAL's cost structure is unprecedented in digital health. The entire platform — API, web app, mobile app, AI services, database — costs fifty dollars and seventy-five cents per month at fifty thousand users. Most digital health startups spend twenty to fifty dollars per user per month. RAIMZEAL spends one-thousandth of a cent. Every grant dollar goes directly to mission, not overhead.",
  },
  {
    label: "THE ASK",
    visual: "Clean slide with three columns: Grants (NIH SBIR, RWJF, Gates) · Partnerships (hospital systems, HBCUs, FQHCs) · Platform (App Store, Play Store, web).",
    duration: "16s",
    script:
      "We are seeking three things: grant partnerships with foundations aligned with health equity and digital health innovation; institutional partnerships with hospital systems, universities, and Federally Qualified Health Centers who want to extend a free, evidence-based wellness platform to their communities; and platform visibility — App Store featuring, press coverage, and community health advocates who believe in this mission.",
  },
  {
    label: "CLOSING – JOIN THE MISSION",
    visual: "RAIMZEAL logo centered. Slow gold glow animation. Text: 'Free. Open. Evidence-Based.' Then: 'raimzeal.com' and contact: 'Dr. Ephraim Oviawe · ECONTEUR LLC'",
    duration: "14s",
    script:
      "Healthcare equity is not a moonshot. It is achievable today, with existing technology, at a cost that any grant can sustain for generations. RAIMZEAL is proof. Free. Open. Evidence-based. Join the mission at raimzeal.com — and help us put evidence-based health in the hands of every human on earth.",
  },
];

// ─── Build all 4 script PDFs ──────────────────────────────────────────────────
function buildScriptPDF(
  filename: string,
  scriptNum: string,
  title: string,
  subtitle: string,
  duration: string,
  segments: Segment[]
) {
  const doc = newDoc(title);
  const out = path.join(OUTPUT_DIR, filename);
  doc.pipe(fs.createWriteStream(out));
  coverPage(doc, scriptNum, title, subtitle, duration);
  scriptPage(doc, segments, 2);
  doc.end();
  console.log(`✅  ${title} → ${out}`);
}

console.log("Generating RAIMZEAL AI Presenter Scripts...\n");

buildScriptPDF(
  "RAIMZEAL-Script-1-User-Guide.pdf",
  "01", "User Guide Script",
  "AI presenter script for Synthesia / HeyGen — 'Your Health, Reimagined'",
  "~136 seconds (9 segments)",
  userGuideSegments
);

buildScriptPDF(
  "RAIMZEAL-Script-2-Developer-Guide.pdf",
  "02", "Developer Guide Script",
  "AI presenter script for Synthesia / HeyGen — 'Build the Future of Healthcare'",
  "~117 seconds (8 segments)",
  devGuideSegments
);

buildScriptPDF(
  "RAIMZEAL-Script-3-Operations-Guide.pdf",
  "03", "Operations Guide Script",
  "AI presenter script for Synthesia / HeyGen — '$50.75/Month. 50,000 Users.'",
  "~142 seconds (9 segments)",
  opsGuideSegments
);

buildScriptPDF(
  "RAIMZEAL-Script-4-Investor-Presentation.pdf",
  "04", "Investor Presentation Script",
  "AI presenter script for Synthesia / HeyGen — 'Health Equity at Zero Cost'",
  "~158 seconds (10 segments)",
  investorSegments
);

console.log("\nAll 4 presenter scripts generated.");
