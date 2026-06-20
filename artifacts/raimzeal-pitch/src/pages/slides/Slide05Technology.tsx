const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const GREEN = "#2D8C4E";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

function TechRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "2vw",
        padding: "1.4vh 1.5vw",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: "0.3vw",
      }}
    >
      <div
        style={{
          fontFamily: ff,
          fontWeight: 700,
          fontSize: "2.5vw",
          color: GREEN,
          minWidth: "28vw",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: ff,
          fontWeight: 400,
          fontSize: "2.5vw",
          color: TEXT,
          lineHeight: 1.3,
        }}
      >
        {detail}
      </div>
    </div>
  );
}

export default function Slide05Technology() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ background: BG, fontFamily: ff }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", background: GOLD }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "5.5vh 8vw 5vh 8vw",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "3.2vw",
            lineHeight: 1.2,
            color: TEXT,
            textWrap: "pretty",
            maxWidth: "88vw",
            marginBottom: "3vh",
          }}
        >
          A modern mobile-first stack delivers AI personalization at negligible infrastructure cost
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", flex: 1 }}>
          <TechRow
            label="Expo SDK 54 / React Native"
            detail="Single codebase for iOS, Android, and web — one team, three platforms"
          />
          <TechRow
            label="Supabase PostgreSQL"
            detail="Row Level Security, enterprise-grade data protection; free tier serves 50K+ users"
          />
          <TechRow
            label="Express 5 + Drizzle ORM"
            detail="Sub-50ms API response times; horizontal scaling ready on Replit deploy"
          />
          <TechRow
            label="Apple Sign In + Google OAuth"
            detail="Meets all App Store privacy compliance requirements (Guideline 5.1.1)"
          />
          <TechRow
            label="OpenAI integration"
            detail="Personalized meal plans and fitness recommendations per user profile"
          />
          <TechRow
            label="Monthly infrastructure"
            detail="~$57/month total (Replit $19, EAS $19, Apple Developer $8 amortized)"
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: "2.2vw",
            color: MUTED,
            opacity: 0.7,
            paddingTop: "2vh",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span>Source: Internal architecture documentation, June 2026</span>
          <span>5 / 12</span>
        </div>
      </div>
    </div>
  );
}
