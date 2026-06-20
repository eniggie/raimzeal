const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

function MarketBar({
  label,
  sublabel,
  value,
  widthPct,
  color,
}: {
  label: string;
  sublabel: string;
  value: string;
  widthPct: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span style={{ fontFamily: ff, fontWeight: 700, fontSize: "2.6vw", color: TEXT }}>{label}</span>
          <span style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.2vw", color: MUTED, marginLeft: "1vw" }}>{sublabel}</span>
        </div>
        <span style={{ fontFamily: ff, fontWeight: 700, fontSize: "2.6vw", color: color }}>{value}</span>
      </div>
      <div style={{ height: "4vh", background: SURFACE, borderRadius: "0.3vw", overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <div
          style={{
            height: "100%",
            width: `${widthPct}%`,
            background: color,
            opacity: 0.85,
            transition: "none",
          }}
        />
      </div>
    </div>
  );
}

export default function Slide07Market() {
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
            marginBottom: "3.5vh",
          }}
        >
          The addressable market is the entire global population in need of preventive healthcare
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh", flex: 1 }}>
          <MarketBar
            label="Total Addressable Market"
            sublabel="(global population)"
            value="8.0B people"
            widthPct={100}
            color="#C8A84B"
          />
          <MarketBar
            label="Serviceable Addressable Market"
            sublabel="(smartphone users, health-seeking)"
            value="4.5B people"
            widthPct={56}
            color="#2D8C4E"
          />
          <MarketBar
            label="Year 1 Target"
            sublabel="(App Store + organic growth)"
            value="10M users"
            widthPct={0.125}
            color="#5B9BD5"
          />
        </div>

        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: "0.3vw",
            padding: "1.5vh 1.5vw",
            marginTop: "2vh",
          }}
        >
          <div style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.4vw", color: TEXT, lineHeight: 1.4 }}>
            No comparable free, AI-personalized, multi-discipline health platform exists at any price point.
            Nearest competitors (Noom, Headspace, MyFitnessPal) cost $8–$70/month with single-discipline focus.
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
            marginTop: "2vh",
          }}
        >
          <span>Source: GSMA Mobile Connectivity Index 2024; Statista Global Health App Market 2025</span>
          <span>7 / 12</span>
        </div>
      </div>
    </div>
  );
}
