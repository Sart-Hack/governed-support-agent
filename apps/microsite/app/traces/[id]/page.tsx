import { PageShell } from "../../components/page-shell";

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell
      eyebrow="Demo"
      title="Traces"
      intro="The full span tree for a run: every LLM call, tool call, and policy decision, with running token cost against the $0.50 ceiling. Step through it, or watch it play."
    >
      <p className="font-mono text-sm text-text-secondary">
        scenario: <span className="text-text-primary">{id}</span>
      </p>
    </PageShell>
  );
}
