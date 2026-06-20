import drImg from "@assets/IMG_1810_1781989043230.png";

const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

export default function Slide09Team() {
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
          Dr. Ephraim Oviawe founded RAIMZEAL from clinical practice and personal conviction
        </div>

        <div style={{ display: "flex", gap: "5vw", flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "3vw", color: GOLD, lineHeight: 1.2 }}>
                Dr. Ephraim Oviawe
              </div>
              <div style={{ fontWeight: 600, fontSize: "2.4vw", color: MUTED, marginTop: "0.5vh" }}>
                Founder & Chief Executive, ECONTEUR LLC
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
                <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
                <div style={{ fontSize: "2.6vw", lineHeight: 1.4, color: TEXT }}>
                  Physician with direct clinical exposure to preventable health failures in underserved and uninsured populations
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
                <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
                <div style={{ fontSize: "2.6vw", lineHeight: 1.4, color: TEXT }}>
                  Dual expertise in clinical medicine and technology entrepreneurship — built RAIMZEAL from zero to App Store submission in under 12 months
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
                <div style={{ width: "0.4vw", minHeight: "2.5vh", background: GOLD, marginTop: "0.5vh", flexShrink: 0 }} />
                <div style={{ fontSize: "2.6vw", lineHeight: 1.4, color: TEXT }}>
                  Mission-driven: RAIMZEAL is designed to serve patients Dr. Oviawe could not reach through the traditional healthcare system
                </div>
              </div>
            </div>
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: "0.3vw",
                padding: "1.2vh 1.5vw",
                marginTop: "auto",
              }}
            >
              <div style={{ fontSize: "2.4vw", color: MUTED }}>
                Advisory board to be formally engaged Q3 2026 — medical, technical, and philanthropic advisors
              </div>
            </div>
          </div>

          <div
            style={{
              width: "28vw",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={drImg}
              crossOrigin="anonymous"
              alt="Dr. Ephraim Oviawe"
              style={{
                width: "100%",
                height: "75vh",
                objectFit: "cover",
                objectPosition: "center top",
                borderRadius: "0.4vw",
                border: `2px solid ${BORDER}`,
              }}
            />
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
          <span>Internal biography, June 2026</span>
          <span>9 / 12</span>
        </div>
      </div>
    </div>
  );
}
