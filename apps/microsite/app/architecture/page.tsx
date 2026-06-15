import { ARCH_LEGEND, ArchitectureDiagram } from "../components/architecture-diagram";
import { PageShell } from "../components/page-shell";

export default function ArchitecturePage() {
  return (
    <PageShell
      eyebrow="Reference"
      title="Architecture"
      intro="How a ticket becomes a governed action: the Mastra workflow, the agent-shield policy decision point that wraps every step, the MCP servers it reaches through, and the trace tree each step writes to Langfuse. Every box links into the repo."
    >
      <div className="rounded-lg border border-border bg-card/40 p-4 md:p-6">
        <ArchitectureDiagram />
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
        {ARCH_LEGEND.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
