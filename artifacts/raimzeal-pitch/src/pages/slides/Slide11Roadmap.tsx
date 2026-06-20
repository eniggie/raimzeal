const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const GREEN = "#2D8C4E";
const BLUE = "#5B9BD5";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

function Milestone({
  quarter,
  title,
  bullets,
  color,
  status,
}: {
  quarter: string;
  title: string;
  bullets: string[];
  color: string;
  status: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderTop: `3px solid ${color}`,
        borderRadius: "0.4vw",
        padding: "2vh 1.5vw",
        display: "flex",
        flexDirection: "column",
        gap: "1vh",
      }}
    >
      <div style={{ fontFamily: ff, fontWeight: 700, fontSize: "2.4vw", color: color }}>{quarter}</div>
      <div style={{ fontFamily: ff, fontWeight: 700, fontSize: "2.6vw", color: TEXT, lineHeight: 1.2 }}>{title}</div>
      <div
        style={{
          display: "inline-block",
          padding: "0.3vh 0.8vw",
          background: color + "22",
          border: `1px solid ${color}55`,
          borderRadius: "2vw",
          fontFamily: ff,
          fontWeight: 600,
          fontSize: "2.1vw",
          color: color,
          alignSelf: "flex-start",
        }}
      >
        {status}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh", marginTop: "0.5vh" }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.3vw", color: MUTED, lineHeight: 1.3 }}>
            — {b}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Slide11Roadmap() {
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
          padding: "5.5vh 6vw 5vh 6vw",
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
          Three 2026 milestones take RAIMZEAL from App Store launch to institutional infrastructure
        </div>

        <div style={{ display: "flex", gap: "1.8vw", flex: 1 }}>
          <Milestone
            quarter="Q2 2026"
            title="iOS App Store Launch"
            bullets={[
              "App Store submission in progress",
              "Apple Sign In compliance complete",
              "UGC moderation policy approved",
            ]}
            color={GOLD}
            status="In Progress"
          />
          <Milestone
            quarter="Q3 2026"
            title="Android + Legal Foundation"
            bullets={[
              "Google Play Store launch",
              "501(c)(3) application filed",
              "First institutional letter of intent",
            ]}
            color={GREEN}
            status="Planned"
          />
          <Milestone
            quarter="Q4 2026"
            title="Scale + First Grant"
            bullets={[
              "50,000 active users",
              "First grant award received",
              "Advisory board constituted",
            ]}
            color={BLUE}
            status="Planned"
          />
          <Milestone
            quarter="H1 2027"
            title="Global Reach"
            bullets={[
              "WHO partnership application",
              "500,000 users milestone",
              "Clinical outcomes study launched",
            ]}
            color="#9B59B6"
            status="Target"
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
            marginTop: "2vh",
          }}
        >
          <span>Internal roadmap, June 2026 — subject to revision</span>
          <span>11 / 12</span>
        </div>
      </div>
    </div>
  );
}
