import { PageShell } from "../components/page-shell";
import { REPO } from "../lib/architecture";
import { ASI_COVERAGE, type AsiCoverage, SUITES, loadEvalResults } from "../lib/evals";

export default function EvalsPage() {
  const results = loadEvalResults();
  const bySuite = new Map(results?.suites.map((s) => [s.suite, s]) ?? []);

  return (
    <PageShell
      eyebrow="Governance"
      title="Evals"
      intro="Three suites keep the policies honest: a scenario-derived custom suite, an InjecAgent injection subset, and one assertion per OWASP Agentic Top 10 ID. They run offline and deterministic via pnpm eval, gated in CI before this site builds; the pass rates and coverage map below come straight from that run."
    >
      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {SUITES.map((suite) => {
            const r = bySuite.get(suite.key);
            return (
              <div key={suite.key} className="rounded-lg border border-border bg-card/40 p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold">{suite.name}</h2>
                  <span className="shrink-0 font-mono text-xs text-text-secondary">
                    {suite.target}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-secondary">{suite.description}</p>
                <p className="mt-4 font-mono text-sm">
                  {r ? (
                    <span className="text-success">
                      {r.passed}/{r.total} pass
                    </span>
                  ) : (
                    <span className="text-text-secondary/70">pending · run pnpm eval</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          OWASP Agentic Top 10 coverage
        </p>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Every ASI id is covered by a Cedar policy, a runtime control, or noted as implicit. The
          policy-backed rows are checked against the real annotations in CI, so this map cannot
          drift from the policies it claims.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card/40">
                <Th>ASI</Th>
                <Th>Threat</Th>
                <Th>Enforced by</Th>
                <Th className="text-right">Coverage</Th>
              </tr>
            </thead>
            <tbody>
              {ASI_COVERAGE.map((row, i) => (
                <tr key={row.id} className={i > 0 ? "border-t border-border/60" : ""}>
                  <td className="px-4 py-2.5 align-top font-mono text-text-primary">{row.id}</td>
                  <td className="px-4 py-2.5 align-top text-text-primary">{row.name}</td>
                  <td className="px-4 py-2.5 align-top text-text-secondary">
                    {row.enforcedBy}
                    {row.policyFiles.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-x-3">
                        {row.policyFiles.map((f) => (
                          <a
                            key={f}
                            href={`${REPO}/packages/policies/policies/${f}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-info hover:underline"
                          >
                            {f}
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right align-top">
                    <CoverageBadge row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[11px] text-text-secondary">
          ASI05 is implicit (role-scoped permits + default deny); ASI07 is partial (shares the PII
          redaction transform). Both noted honestly rather than claimed as dedicated policies.
        </p>
      </section>
    </PageShell>
  );
}

function CoverageBadge({ row }: { row: AsiCoverage }) {
  const style =
    row.strength === "full"
      ? {
          glyph: "✓",
          className: "text-success",
          label: row.policyFiles.length ? "policy" : "runtime",
        }
      : row.strength === "partial"
        ? { glyph: "◑", className: "text-approval", label: "partial" }
        : { glyph: "◑", className: "text-approval", label: "implicit" };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${style.className}`}>
      <span aria-hidden>{style.glyph}</span>
      {style.label}
    </span>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-text-secondary ${className}`}
    >
      {children}
    </th>
  );
}
