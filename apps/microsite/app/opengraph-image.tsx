import { ImageResponse } from "next/og";

// Purpose-built OG card. Mirrors the /architecture flow at a thumbnail-legible
// scale rather than reproducing the dense coordinate SVG (Satori can't render
// its markers/defs/CSS vars). Colors are the brand tokens from globals.css.
export const alt =
  "Governed Support Ops Agent: a Zendesk ticket flows through a Mastra workflow, gated by agent-shield, out to four MCP servers.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLOR = {
  base: "#0a0a0a",
  card: "#171717",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#ffffff",
  textSecondary: "#a3a3a3",
  policy: "#8b5cf6",
  success: "#46a758",
};

function Pill({ label, accent }: { label: string; accent?: string }) {
  const color = accent ?? COLOR.textSecondary;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 18px",
        borderRadius: 10,
        border: `1px solid ${color}`,
        background: accent ? `${accent}1f` : COLOR.card,
        color: COLOR.textPrimary,
        fontSize: 24,
      }}
    >
      {label}
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ display: "flex", color: COLOR.textSecondary, fontSize: 28, padding: "0 4px" }}>
      →
    </div>
  );
}

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: COLOR.base,
        padding: 72,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: COLOR.textSecondary,
          }}
        >
          Governed Support Ops Agent
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.1,
            color: COLOR.textPrimary,
            maxWidth: 980,
          }}
        >
          AI agents your security team will actually approve.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <Pill label="Zendesk" />
        <Arrow />
        <Pill label="Workflow" />
        <Arrow />
        <Pill label="agent-shield" accent={COLOR.policy} />
        <Arrow />
        <Pill label="MCP servers" accent={COLOR.success} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontSize: 22,
          color: COLOR.textSecondary,
        }}
      >
        <span style={{ display: "flex", color: COLOR.policy }}>Cedar policies</span>
        <span style={{ display: "flex" }}>Audit log</span>
        <span style={{ display: "flex" }}>Kill-switch</span>
        <span style={{ display: "flex" }}>MCP scope check</span>
        <span style={{ display: "flex" }}>Circuit breaker</span>
      </div>
    </div>,
    { ...size },
  );
}
