import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { SUITES, loadEvalResults } from "../lib/evals";

// Every boundary below is enforced by a named Cedar policy in this repo, not a
// promise. The policy file and its OWASP-ASI mapping are listed so the claim is
// checkable against /policies.
const BOUNDARIES = [
  {
    action: "Delete or permanently destroy an account or its data",
    policy: "06-delete-account-never",
    asi: "ASI10 Rogue Agents",
  },
  {
    action: "Send a customer-facing message without human approval",
    policy: "05-customer-facing-requires-approval",
    asi: "ASI03 Delegated Trust",
  },
  {
    action: "Read or act on another tenant's data",
    policy: "07-tenant-isolation",
    asi: "ASI06 Inter-Agent / Cross-Boundary",
  },
  {
    action: "Pass unredacted customer PII into the model context",
    policy: "03-hubspot-pii-redacted",
    asi: "ASI04 Data Exfiltration",
  },
];

const MODEL_FACTS = [
  { label: "Model", value: "openai/gpt-4o-mini (via Bifrost)" },
  { label: "Temperature", value: "0 (deterministic planning)" },
  { label: "List price", value: "$0.15 / 1M prompt · $0.60 / 1M completion" },
  { label: "Per-run cost ceiling", value: "$0.50 (circuit breaker)" },
  { label: "Deployed-demo spend, 24h", value: "$0.00 (recorded runs, no live LLM)" },
];

export default function TrustPage() {
  const evals = loadEvalResults();
  return (
    <PageShell
      eyebrow="Disclosure"
      title="Trust"
      intro="Honest by default: the actions this agent will never automate, the models it runs, and what it costs. Every boundary here is enforced by a named policy you can read on the policies page."
    >
      <section>
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          Will never automate
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          {BOUNDARIES.map((b, i) => (
            <div
              key={b.policy}
              className={`flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="flex items-baseline gap-2 text-sm text-text-primary">
                <span aria-hidden className="font-mono text-danger">
                  ✕
                </span>
                {b.action}
              </span>
              <span className="shrink-0 font-mono text-xs text-text-secondary">
                {b.policy} · {b.asi}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          Models and cost
        </p>
        <dl className="mt-4 overflow-hidden rounded-lg border border-border">
          {MODEL_FACTS.map((f, i) => (
            <div
              key={f.label}
              className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <dt className="text-sm text-text-secondary">{f.label}</dt>
              <dd className="font-mono text-sm text-text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">Evals</p>
        {evals ? (
          <>
            <dl className="mt-4 overflow-hidden rounded-lg border border-border">
              {SUITES.map((suite, i) => {
                const result = evals.suites.find((s) => s.suite === suite.key);
                return (
                  <div
                    key={suite.key}
                    className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <dt className="text-sm text-text-secondary">
                      {suite.name}{" "}
                      <span className="font-mono text-xs text-text-secondary/70">
                        ({suite.target})
                      </span>
                    </dt>
                    <dd className="font-mono text-sm text-text-primary">
                      {result ? `${result.passed} / ${result.total}` : "pending"}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-sm text-text-secondary">
              Run offline and deterministic via <code className="font-mono">pnpm eval</code>, gated
              in CI before the microsite build. Per-ID coverage is on the{" "}
              <Link href="/evals" className="text-info hover:underline">
                evals page
              </Link>
              .
            </p>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card/40 p-5">
            <p className="text-sm text-text-secondary">
              The public eval suite (InjecAgent, a custom set, and OWASP-ASI assertions) runs
              offline via <code className="font-mono">pnpm eval</code>. Targets are custom at or
              above 90%, InjecAgent at or above 80%, and 10 of 10 ASI assertions. No pass rate is
              shown until the suite runs; a placeholder number would defeat the point of this page.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
