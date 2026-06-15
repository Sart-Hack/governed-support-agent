// Hand-authored layout for the architecture diagram. Coordinates are deliberate
// (8px grid), not produced by an auto-layout engine. The component in
// architecture-diagram.tsx renders these nodes/bands/links as inline SVG and
// resolves connector paths from the node geometry.

export const REPO = "https://github.com/Sart-Hack/governed-support-agent/blob/main";

export type NodeKind = "source" | "step" | "policy" | "approval" | "tool" | "observability";

export interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: NodeKind;
  href?: string;
  real?: boolean; // dashed-to-solid accent for the one real-API server
}

export interface ArchBand {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = "top" | "bottom" | "left" | "right";

export interface ArchLink {
  from: { id: string; side: Side };
  to: { id: string; side: Side };
  label?: string;
  dashed?: boolean;
}

export const VIEWBOX = { w: 960, h: 600 };

export const BANDS: ArchBand[] = [
  { id: "workflow-band", label: "apps/agent · Mastra v2 workflow", x: 40, y: 128, w: 640, h: 150 },
  {
    id: "shield-band",
    label: "agent-shield · policy decision point",
    x: 40,
    y: 312,
    w: 640,
    h: 104,
  },
];

const STEP_Y = 200;
const STEP_W = 92;
const STEP_H = 52;
const stepX = (i: number) => 52 + i * 100;

export const NODES: ArchNode[] = [
  {
    id: "ticket",
    label: "Zendesk ticket",
    sublabel: "support queue",
    x: 40,
    y: 32,
    w: 200,
    h: 56,
    kind: "source",
    href: `${REPO}/packages/mcp-server-zendesk`,
  },

  // The six workflow steps, left to right.
  { id: "ingest", label: "ingest", x: stepX(0), y: STEP_Y, w: STEP_W, h: STEP_H, kind: "step" },
  { id: "triage", label: "triage", x: stepX(1), y: STEP_Y, w: STEP_W, h: STEP_H, kind: "step" },
  {
    id: "policy-check",
    label: "policy-check",
    x: stepX(2),
    y: STEP_Y,
    w: STEP_W,
    h: STEP_H,
    kind: "policy",
  },
  {
    id: "approval-gate",
    label: "approval-gate",
    x: stepX(3),
    y: STEP_Y,
    w: STEP_W,
    h: STEP_H,
    kind: "approval",
  },
  {
    id: "execute",
    label: "execute",
    x: stepX(4),
    y: STEP_Y,
    w: STEP_W,
    h: STEP_H,
    kind: "tool",
  },
  { id: "audit", label: "audit", x: stepX(5), y: STEP_Y, w: STEP_W, h: STEP_H, kind: "step" },

  // The four MCP servers.
  {
    id: "zendesk",
    label: "zendesk",
    sublabel: "mock · full spec",
    x: 52,
    y: 452,
    w: 144,
    h: 60,
    kind: "tool",
    href: `${REPO}/packages/mcp-server-zendesk`,
  },
  {
    id: "notion",
    label: "notion",
    sublabel: "mock · full spec",
    x: 208,
    y: 452,
    w: 144,
    h: 60,
    kind: "tool",
    href: `${REPO}/packages/mcp-server-notion`,
  },
  {
    id: "hubspot",
    label: "hubspot",
    sublabel: "mock · full spec",
    x: 364,
    y: 452,
    w: 144,
    h: 60,
    kind: "tool",
    href: `${REPO}/packages/mcp-server-hubspot`,
  },
  {
    id: "github",
    label: "github",
    sublabel: "real API",
    x: 520,
    y: 452,
    w: 144,
    h: 60,
    kind: "tool",
    real: true,
    href: `${REPO}/packages/mcp-server-github`,
  },

  // Observability and human-in-the-loop, on the right.
  {
    id: "slack",
    label: "Slack approval",
    sublabel: "suspend / resume",
    x: 740,
    y: 72,
    w: 180,
    h: 64,
    kind: "approval",
    href: `${REPO}/apps/agent/src/slack`,
  },
  {
    id: "langfuse",
    label: "Langfuse",
    sublabel: "OTel · gen_ai.* semconv",
    x: 740,
    y: 168,
    w: 180,
    h: 120,
    kind: "observability",
    href: `${REPO}/packages/tracing`,
  },
];

export const LINKS: ArchLink[] = [
  { from: { id: "ticket", side: "bottom" }, to: { id: "ingest", side: "top" } },
  { from: { id: "ingest", side: "right" }, to: { id: "triage", side: "left" } },
  { from: { id: "triage", side: "right" }, to: { id: "policy-check", side: "left" } },
  { from: { id: "policy-check", side: "right" }, to: { id: "approval-gate", side: "left" } },
  { from: { id: "approval-gate", side: "right" }, to: { id: "execute", side: "left" } },
  { from: { id: "execute", side: "right" }, to: { id: "audit", side: "left" } },
  {
    from: { id: "approval-gate", side: "top" },
    to: { id: "slack", side: "left" },
    label: "approve / reject",
  },
  { from: { id: "audit", side: "right" }, to: { id: "langfuse", side: "left" }, label: "spans" },
];

// Chips shown inside the shield band: the five controls agent-shield provides.
export const SHIELD_CHIPS: { label: string; href: string }[] = [
  { label: "Cedar policies", href: `${REPO}/packages/policies/policies` },
  { label: "Audit log", href: `${REPO}/packages/agent-shield/src/audit` },
  { label: "Kill-switch", href: `${REPO}/packages/agent-shield/src/kill-switch` },
  { label: "Scope-check", href: `${REPO}/packages/agent-shield/src/scope-check` },
  { label: "Circuit breaker", href: `${REPO}/packages/agent-shield/src/circuit-breaker` },
];

export function nodeById(id: string): ArchNode | undefined {
  return NODES.find((n) => n.id === id);
}

export function anchor(node: ArchNode, side: Side): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: node.x + node.w / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.w / 2, y: node.y + node.h };
    case "left":
      return { x: node.x, y: node.y + node.h / 2 };
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 };
  }
}
