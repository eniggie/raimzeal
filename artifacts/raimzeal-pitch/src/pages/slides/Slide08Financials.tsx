const ff = '"Source Sans 3", system-ui, sans-serif';
const GOLD = "#C8A84B";
const TEXT = "#F0EDE8";
const MUTED = "#888888";
const BG = "#0D0D0D";
const SURFACE = "#181818";
const BORDER = "#2A2A2A";
const HEADER_BG = "#222222";

function TableRow({
  item,
  monthly,
  annual,
  highlight,
}: {
  item: string;
  monthly: string;
  annual: string;
  highlight?: boolean;
}) {
  return (
    <tr
      style={{
        background: highlight ? "#1E1A10" : SURFACE,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <td
        style={{
          fontFamily: ff,
          fontWeight: highlight ? 700 : 400,
          fontSize: "2.5vw",
          color: highlight ? GOLD : TEXT,
          padding: "1.2vh 1.5vw",
          textAlign: "left",
        }}
      >
        {item}
      </td>
      <td
        style={{
          fontFamily: ff,
          fontWeight: highlight ? 700 : 400,
          fontSize: "2.5vw",
          color: highlight ? GOLD : TEXT,
          padding: "1.2vh 1.5vw",
          textAlign: "right",
        }}
      >
        {monthly}
      </td>
      <td
        style={{
          fontFamily: ff,
          fontWeight: highlight ? 700 : 400,
          fontSize: "2.5vw",
          color: highlight ? GOLD : TEXT,
          padding: "1.2vh 1.5vw",
          textAlign: "right",
        }}
      >
        {annual}
      </td>
    </tr>
  );
}

export default function Slide08Financials() {
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
          A single $500K grant funds eight years of full operations at current infrastructure costs
        </div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: `1px solid ${BORDER}`,
              borderRadius: "0.4vw",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: HEADER_BG, borderBottom: `2px solid ${GOLD}` }}>
                <th
                  style={{
                    fontFamily: ff,
                    fontWeight: 700,
                    fontSize: "2.5vw",
                    color: MUTED,
                    padding: "1.2vh 1.5vw",
                    textAlign: "left",
                    letterSpacing: "0.05em",
                  }}
                >
                  Cost Item
                </th>
                <th
                  style={{
                    fontFamily: ff,
                    fontWeight: 700,
                    fontSize: "2.5vw",
                    color: MUTED,
                    padding: "1.2vh 1.5vw",
                    textAlign: "right",
                    letterSpacing: "0.05em",
                  }}
                >
                  Monthly
                </th>
                <th
                  style={{
                    fontFamily: ff,
                    fontWeight: 700,
                    fontSize: "2.5vw",
                    color: MUTED,
                    padding: "1.2vh 1.5vw",
                    textAlign: "right",
                    letterSpacing: "0.05em",
                  }}
                >
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              <TableRow item="Replit hosting (Starter)" monthly="$19" annual="$228" />
              <TableRow item="EAS mobile builds (Starter)" monthly="$19" annual="$228" />
              <TableRow item="Apple Developer Program" monthly="~$8" annual="$99" />
              <TableRow item="Supabase database" monthly="$0" annual="$0" />
              <TableRow item="Domain & miscellaneous" monthly="~$5" annual="$60" />
              <TableRow item="TOTAL" monthly="~$51" annual="~$615" highlight />
            </tbody>
          </table>
        </div>

        <div
          style={{
            background: "#1A1E1A",
            border: `1px solid #2D8C4E`,
            borderRadius: "0.3vw",
            padding: "1.5vh 1.5vw",
            marginTop: "2vh",
          }}
        >
          <div style={{ fontFamily: ff, fontWeight: 400, fontSize: "2.4vw", color: TEXT, lineHeight: 1.4 }}>
            $500K grant funds 813 years at current burn. Supabase free tier supports 50,000 users with zero incremental cost.
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
            paddingTop: "1.5vh",
            borderTop: `1px solid ${BORDER}`,
            marginTop: "1.5vh",
          }}
        >
          <span>Source: Replit, EAS, Apple Developer, Supabase pricing — June 2026</span>
          <span>8 / 12</span>
        </div>
      </div>
    </div>
  );
}
