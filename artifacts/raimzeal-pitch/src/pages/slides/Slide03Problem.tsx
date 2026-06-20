const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const BORDER = "#2A2A2A";

export default function Slide03Problem() {
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
          5.4 billion people lack access to personalized, affordable preventive healthcare
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.2vh", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Chronic disease causes 74% of all global deaths; the majority are preventable through lifestyle intervention
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Quality nutrition guidance costs $50–$300/month through private services; free options are generic and culturally unadapted
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Mental health care is financially inaccessible in 85% of low- and middle-income countries
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Fitness programming costs $30–$150/month; no culturally adaptive free alternative exists at scale
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2vw" }}>
            <div style={{ width: "0.4vw", minHeight: "3vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
            <div style={{ fontSize: "2.8vw", lineHeight: 1.4, color: TEXT }}>
              Healthcare systems are structurally reactive — designed to treat illness after it occurs, not to prevent it
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
          <span>Source: WHO Global Burden of Disease Study 2024; Lancet Mental Health 2023</span>
          <span>3 / 12</span>
        </div>
      </div>
    </div>
  );
}
