import { PageShell } from "../components/page-shell";

export default function ShieldPage() {
  return (
    <PageShell
      eyebrow="Library"
      title="agent-shield"
      intro="The governance layer this agent runs on, extracted as a drop-in library: Cedar policies, append-only audit log, kill-switch, MCP scope check, and circuit breaker behind one wrap() call for any MCP-based agent."
    />
  );
}
