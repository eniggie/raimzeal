const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

export default function Slide06Model() {
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
          padding: "6vh 8vw 5vh 8vw",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "3.4vw",
            lineHeight: 1.2,
            color: TEXT,
            textWrap: "pretty",
            maxWidth: "88vw",
            marginBottom: "4vh",
          }}
        >
          A non-profit foundation structure allows RAIMZEAL to remain permanently free
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.2vh", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              ECONTEUR LLC houses current operations; 501(c)(3) application is the next governance milestone, targeted Q3 2026
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Primary revenue pathway: grants from WHO, the Gates Foundation, NIH, and health-focused philanthropists
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Institutional partnerships: hospital systems, universities, and corporate wellness programs contribute in-kind
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Technology credits from Apple, Google, and Replit further reduce cash infrastructure requirements
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Free access is both the product promise and the competitive moat — no VC monetization pressure, ever
            </div>
          </div>
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
          <span>Source: Internal business model documentation</span>
          <span>6 / 12</span>
        </div>
      </div>
    </div>
  );
}
