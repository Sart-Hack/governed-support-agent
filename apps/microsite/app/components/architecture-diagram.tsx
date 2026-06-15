import {
  type ArchNode,
  BANDS,
  LINKS,
  NODES,
  type NodeKind,
  SHIELD_CHIPS,
  type Side,
  VIEWBOX,
  anchor,
  nodeById,
} from "../lib/architecture";

const KIND_COLOR: Record<NodeKind, string> = {
  source: "var(--color-text-secondary)",
  step: "var(--color-info)",
  policy: "var(--color-policy)",
  approval: "var(--color-approval)",
  tool: "var(--color-success)",
  observability: "var(--color-info)",
};

function pathFor(from: ArchNode, fromSide: Side, to: ArchNode, toSide: Side): string {
  const a = anchor(from, fromSide);
  const b = anchor(to, toSide);
  if (fromSide === "right" && toSide === "left") {
    if (a.y === b.y) return `M${a.x} ${a.y} H${b.x}`;
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} H${mx} V${b.y} H${b.x}`;
  }
  if (fromSide === "bottom" && toSide === "top") {
    const my = (a.y + b.y) / 2;
    return `M${a.x} ${a.y} V${my} H${b.x} V${b.y}`;
  }
  if (fromSide === "top" && toSide === "left") {
    return `M${a.x} ${a.y} V${b.y} H${b.x}`;
  }
  return `M${a.x} ${a.y} L${b.x} ${b.y}`;
}

// Place a link's label on a clear stretch of its route, not on top of the target.
function labelPos(
  from: ArchNode,
  fromSide: Side,
  to: ArchNode,
  toSide: Side,
): { x: number; y: number } {
  const a = anchor(from, fromSide);
  const b = anchor(to, toSide);
  if (fromSide === "top" && toSide === "left") {
    return { x: (a.x + b.x) / 2, y: b.y - 8 };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8 };
}

function NodeBox({ node }: { node: ArchNode }) {
  const color = KIND_COLOR[node.kind];
  const cx = node.x + node.w / 2;
  const hasSub = Boolean(node.sublabel);
  const body = (
    <>
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={8}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeOpacity={node.real ? 0.9 : 0.55}
        strokeWidth={node.real ? 2 : 1.5}
        strokeDasharray={node.real ? "5 3" : undefined}
      />
      <text
        x={cx}
        y={hasSub ? node.y + node.h / 2 - 4 : node.y + node.h / 2 + 4}
        textAnchor="middle"
        fontSize={node.w <= 100 ? 11 : 13}
        fill="var(--color-text-primary)"
      >
        {node.label}
      </text>
      {hasSub ? (
        <text
          x={cx}
          y={node.y + node.h / 2 + 13}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-text-secondary)"
        >
          {node.sublabel}
        </text>
      ) : null}
    </>
  );
  if (!node.href) return body;
  return (
    <a href={node.href} target="_blank" rel="noreferrer">
      <title>{`${node.label}: open in repo`}</title>
      {body}
    </a>
  );
}

export function ArchitectureDiagram() {
  // Tool bus: the shield dispatches governed calls down to the four MCP servers.
  const toolCenters = ["zendesk", "notion", "hubspot", "github"]
    .map((id) => nodeById(id))
    .filter((n): n is ArchNode => Boolean(n))
    .map((n) => n.x + n.w / 2);
  const busY = 432;
  const busLeft = Math.min(...toolCenters);
  const busRight = Math.max(...toolCenters);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="h-auto w-full font-mono"
      role="img"
      aria-label="Architecture: a Zendesk ticket flows through the Mastra workflow, gated by agent-shield, out to four MCP servers, with traces to Langfuse and approvals via Slack."
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-text-secondary)" />
        </marker>
      </defs>

      {/* Bands */}
      {BANDS.map((band) => (
        <g key={band.id}>
          <rect
            x={band.x}
            y={band.y}
            width={band.w}
            height={band.h}
            rx={12}
            fill="var(--color-card)"
            fillOpacity={0.5}
            stroke="var(--color-border)"
          />
          <text x={band.x + 14} y={band.y + 20} fontSize={11} fill="var(--color-text-secondary)">
            {band.label}
          </text>
        </g>
      ))}

      {/* Shield chips */}
      {SHIELD_CHIPS.map((chip, i) => {
        const x = 56 + i * 124;
        return (
          <a key={chip.label} href={chip.href} target="_blank" rel="noreferrer">
            <title>{`${chip.label}: open in repo`}</title>
            <rect
              x={x}
              y={356}
              width={112}
              height={30}
              rx={6}
              fill="var(--color-policy)"
              fillOpacity={0.1}
              stroke="var(--color-policy)"
              strokeOpacity={0.4}
            />
            <text
              x={x + 56}
              y={375}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-text-primary)"
            >
              {chip.label}
            </text>
          </a>
        );
      })}

      {/* workflow wrapped by the shield */}
      <path
        d="M360 278 V312"
        stroke="var(--color-policy)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        fill="none"
      />
      <text x={368} y={300} fontSize={10} fill="var(--color-policy)">
        shield().wrap()
      </text>

      {/* Tool bus from the shield down to the MCP servers */}
      <path
        d={`M360 416 V${busY}`}
        stroke="var(--color-text-secondary)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d={`M${busLeft} ${busY} H${busRight}`}
        stroke="var(--color-text-secondary)"
        strokeWidth={1.5}
        fill="none"
      />
      {toolCenters.map((cx) => (
        <path
          key={cx}
          d={`M${cx} ${busY} V452`}
          stroke="var(--color-text-secondary)"
          strokeWidth={1.5}
          fill="none"
          markerEnd="url(#arrow)"
        />
      ))}
      <text x={368} y={428} fontSize={10} fill="var(--color-text-secondary)">
        governed tool calls
      </text>

      {/* Semantic links */}
      {LINKS.map((link) => {
        const from = nodeById(link.from.id);
        const to = nodeById(link.to.id);
        if (!from || !to) return null;
        const d = pathFor(from, link.from.side, to, link.to.side);
        const label = labelPos(from, link.from.side, to, link.to.side);
        return (
          <g key={`${link.from.id}-${link.to.id}`}>
            <path
              d={d}
              stroke="var(--color-text-secondary)"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#arrow)"
            />
            {link.label ? (
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-text-secondary)"
              >
                {link.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Nodes on top */}
      {NODES.map((node) => (
        <NodeBox key={node.id} node={node} />
      ))}
    </svg>
  );
}

export const ARCH_LEGEND: { color: string; label: string }[] = [
  { color: "var(--color-text-secondary)", label: "input · source" },
  { color: "var(--color-info)", label: "agent step · observability" },
  { color: "var(--color-policy)", label: "policy decision" },
  { color: "var(--color-approval)", label: "approval · human in the loop" },
  { color: "var(--color-success)", label: "tool · MCP server" },
];
