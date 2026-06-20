const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

function EquityRow({
  party,
  pct,
  note,
  barColor,
}: {
  party: string;
  pct: string;
  note: string;
  barColor: string;
}) {
  const numPct = parseFloat(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: ff, fontWeight: 600, fontSize: "2.5vw", color: TEXT }}>{party}</span>
        <span style={{ fontFamily: ff, fontWeight: 700, fontSize: "2.5vw", color: barColor }}>{pct}</span>
      </div>
      <div style={{ height: "2.5vh", background: SURFACE, borderRadius: "0.2vw", overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <div style={{ height: "100%", width: `${numPct}%`, background: barColor, opacity: 0.8 }} />
      </div>
      <div style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.2vw", color: MUTED }}>{note}</div>
    </div>
  );
}

export default function Slide10Governance() {
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
          A mission-first equity structure protects free access for all users permanently
        </div>

        <div style={{ display: "flex", gap: "6vw", flex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <EquityRow
              party="Founder (Dr. Oviawe)"
              pct="85%"
              note="Controlling vote on all free-access and mission decisions"
              barColor={GOLD}
            />
            <EquityRow
              party="Medical & Technical Advisors"
              pct="10%"
              note="Equity pool to be allocated Q3 2026 through formal advisory agreements"
              barColor="#2D8C4E"
            />
            <EquityRow
              party="Philanthropic Advisors"
              pct="5%"
              note="Reserved for institutional partners contributing strategic value"
              barColor="#5B9BD5"
            />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div style={{ fontWeight: 600, fontSize: "2.6vw", color: GOLD, marginBottom: "0.5vh" }}>
              Structural protections
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
              <div style={{ fontSize: "2.5vw", lineHeight: 1.4, color: TEXT }}>
                All equity agreements contain explicit prohibition on user monetization
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
              <div style={{ fontSize: "2.5vw", lineHeight: 1.4, color: TEXT }}>
                501(c)(3) conversion locks non-profit status — no future investor can reverse it
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
              <div style={{ fontSize: "2.5vw", lineHeight: 1.4, color: TEXT }}>
                Governance board to include patient advocates and community health workers
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
              <div style={{ fontSize: "2.5vw", lineHeight: 1.4, color: TEXT }}>
                No VC investors — foundation grants and institutional partnerships are the sole funding pathway
              </div>
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
            marginTop: "2vh",
          }}
        >
          <span>Internal governance documentation, June 2026</span>
          <span>10 / 12</span>
        </div>
      </div>
    </div>
  );
}
