const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const GREEN = "#2D8C4E";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";

function PillarCard({
  title,
  line1,
  line2,
}: {
  title: string;
  line1: string;
  line2: string;
}) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${GOLD}`,
        borderRadius: "0.4vw",
        padding: "2vh 1.8vw",
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: ff,
          fontWeight: 700,
          fontSize: "2.6vw",
          color: GOLD,
          marginBottom: "1vh",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: ff,
          fontWeight: 400,
          fontSize: "2.3vw",
          color: TEXT,
          lineHeight: 1.4,
        }}
      >
        {line1}
      </div>
      <div
        style={{
          fontFamily: ff,
          fontWeight: 400,
          fontSize: "2.3vw",
          color: MUTED,
          lineHeight: 1.4,
          marginTop: "0.5vh",
        }}
      >
        {line2}
      </div>
    </div>
  );
}

export default function Slide04Platform() {
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
          padding: "5vh 6vw 5vh 6vw",
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
            marginBottom: "3.5vh",
          }}
        >
          RAIMZEAL integrates six health disciplines into one free, AI-personalized application
        </div>

        <div style={{ display: "flex", gap: "1.8vw", marginBottom: "1.8vh", flex: 1 }}>
          <PillarCard
            title="Fitness"
            line1="Custom workout plans and guided exercise"
            line2="Progress tracking and adaptive programming"
          />
          <PillarCard
            title="Food Therapy"
            line1="Culturally adaptive AI meal plans"
            line2="Nutritional analysis and food-as-medicine"
          />
          <PillarCard
            title="Mental Wellness"
            line1="Mood journaling and AI-guided check-ins"
            line2="Stress management and crisis resources"
          />
        </div>

        <div style={{ display: "flex", gap: "1.8vw", flex: 1 }}>
          <PillarCard
            title="Community"
            line1="Social support and shared progress"
            line2="Peer accountability and challenge boards"
          />
          <PillarCard
            title="Sleep & Recovery"
            line1="Sleep tracking and circadian guidance"
            line2="Recovery protocols and readiness scores"
          />
          <PillarCard
            title="Preventive Care"
            line1="Health risk assessment and screening reminders"
            line2="Proactive alerts and lifestyle interventions"
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
            paddingTop: "1.5vh",
            marginTop: "1.5vh",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span>RAIMZEAL v1.3.0 feature set</span>
          <span>4 / 12</span>
        </div>
      </div>
    </div>
  );
}
