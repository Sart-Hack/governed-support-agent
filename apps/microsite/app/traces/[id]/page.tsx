import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../components/page-shell";
import { TraceViewer } from "../../components/trace-viewer";
import { traceById, traceIds, traceSummaries } from "../../lib/trace";

export function generateStaticParams() {
  return traceIds().map((id) => ({ id }));
}

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = traceById(id);
  if (!trace) notFound();

  return (
    <PageShell
      eyebrow="Demo"
      title="Traces"
      intro="The full span tree for a run: every LLM call, tool call, and policy decision, with running token cost against the $0.50 ceiling. Step through it, or watch it play."
    >
      <TraceSwitcher activeId={id} />

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{trace.title}</h2>
          <span className="font-mono text-xs text-text-secondary">ticket {trace.ticket}</span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">{trace.summary}</p>
      </div>

      <div className="mt-6">
        <TraceViewer trace={trace} />
      </div>
    </PageShell>
  );
}

function TraceSwitcher({ activeId }: { activeId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {traceSummaries().map((t) => {
        const active = t.id === activeId;
        return (
          <Link
            key={t.id}
            href={`/traces/${t.id}`}
            className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
              active
                ? "border-info bg-info/10 text-text-primary"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.ticket} · {t.title}
          </Link>
        );
      })}
    </div>
  );
}
