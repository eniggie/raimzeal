import logoImg from "@assets/002FEB67-8D79-4211-94B8-51ECBB9D3E78_1781989043230.png";

const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const GREEN = "#2D8C4E";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

export default function Slide12Closing() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ background: BG, fontFamily: ff }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, #0D0D0D 50%, #1A1410 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "0.5vw", background: GOLD }} />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, #C8A84B 0%, transparent 70%)",
          opacity: 0.06,
          transform: "translate(20%, 30%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "7vh 8vw",
        }}
      >
        <img
          src={logoImg}
          crossOrigin="anonymous"
          alt="RAIMZEAL"
          style={{ height: "6vh", width: "auto" }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "3.6vw",
              lineHeight: 1.1,
              color: TEXT,
              fontStyle: "italic",
              textWrap: "balance",
            }}
          >
            "Health is a right, not a privilege."
          </div>
          <div style={{ fontWeight: 400, fontSize: "2.4vw", color: MUTED }}>
            — Dr. Ephraim Oviawe, Founder, RAIMZEAL
          </div>

          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: "0.4vw",
              padding: "2.5vh 2.5vw",
              maxWidth: "55vw",
              marginTop: "2vh",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "2.6vw", color: GOLD, marginBottom: "1.5vh" }}>
              We are seeking
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "2.5vw", color: TEXT }}>— Grant partnerships ($250K–$2M)</div>
              <div style={{ fontSize: "2.5vw", color: TEXT }}>— Institutional advisory relationships</div>
              <div style={{ fontSize: "2.5vw", color: TEXT }}>— In-kind technology contributions</div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
            <div style={{ fontWeight: 600, fontSize: "2.4vw", color: TEXT }}>Dr. Ephraim Oviawe</div>
            <div style={{ fontWeight: 400, fontSize: "2.2vw", color: MUTED }}>ECONTEUR LLC</div>
            <a
              href="https://raimzeal.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 400, fontSize: "2.2vw", color: GOLD, textDecoration: "none" }}
            >
              raimzeal.com
            </a>
          </div>
          <div style={{ fontWeight: 400, fontSize: "2.2vw", color: MUTED }}>
            Confidential — June 2026
          </div>
        </div>
      </div>
    </div>
  );
}
