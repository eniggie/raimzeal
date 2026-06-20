const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

export default function Slide02Executive() {
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
            maxWidth: "85vw",
            marginBottom: "4vh",
          }}
        >
          RAIMZEAL delivers free, personalized healthcare to anyone with a smartphone
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.2vh", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Six health disciplines — fitness, food therapy, mental wellness, sleep, hydration, and preventive care — in one application
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Available free on iOS, Android, and web — no subscription, no paywall, no advertising, ever
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Non-profit structure under ECONTEUR LLC enables grant funding, institutional partnership, and mission permanence
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Version 1.3.0 is live; iOS App Store submission is in progress as of June 2026
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Monthly infrastructure cost is under $60 — a single $1M grant funds over 17 years of operations
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
          <span>Internal documentation, June 2026</span>
          <span>2 / 12</span>
        </div>
      </div>
    </div>
  );
}
