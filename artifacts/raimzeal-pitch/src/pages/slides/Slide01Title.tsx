import logoImg from "@assets/002FEB67-8D79-4211-94B8-51ECBB9D3E78_1781989043230.png";

const ff = '"Source Sans 3", system-ui, sans-serif';

export default function Slide01Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #0D0D0D 60%, #1A1410 100%)" }}
      />
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: "0.5vw", background: "#C8A84B" }}
      />
      <div
        className="absolute bottom-0 right-0 rounded-full opacity-[0.07]"
        style={{
          width: "55vw",
          height: "55vw",
          background: "radial-gradient(circle, #C8A84B 0%, transparent 70%)",
          transform: "translate(20%, 30%)",
        }}
      />

      <div
        className="absolute inset-0 flex flex-col justify-between"
        style={{ padding: "7vh 8vw" }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src={logoImg}
            crossOrigin="anonymous"
            alt="RAIMZEAL"
            style={{ height: "6vh", width: "auto" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div
            style={{
              fontFamily: ff,
              fontWeight: 700,
              fontSize: "8vw",
              lineHeight: 1.0,
              color: "#C8A84B",
              letterSpacing: "-0.02em",
              textWrap: "balance",
            }}
          >
            RAIMZEAL
          </div>
          <div
            style={{
              fontFamily: ff,
              fontWeight: 600,
              fontSize: "3vw",
              lineHeight: 1.3,
              color: "#F0EDE8",
              maxWidth: "60vw",
              textWrap: "pretty",
            }}
          >
            Free AI-Powered Healthcare for Every Human
          </div>
          <div
            style={{
              fontFamily: ff,
              fontWeight: 400,
              fontSize: "2.4vw",
              color: "#888888",
              marginTop: "0.5vh",
            }}
          >
            ECONTEUR LLC — Dr. Ephraim Oviawe, Founder
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.2vw", color: "#888888" }}
          >
            June 2026
          </div>
          <div
            style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.2vw", color: "#888888" }}
          >
            Confidential
          </div>
        </div>
      </div>
    </div>
  );
}
