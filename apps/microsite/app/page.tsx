import Link from "next/link";
import injectionProof from "./lib/injection-proof.json";
import { refusalScenes } from "./lib/refusals-data";
import { traceById } from "./lib/trace";

// GitHub blob base, matching the constant used by the nav, footer, and
// architecture page. Used to point the injection card at the inspectable
// detector module and its eval, since that defense is a runtime control, not a
// Cedar denial replayed on /refusals.
const REPO = "https://github.com/Sart-Hack/governed-support-agent/blob/main";

// Each proof card is a real governed run. The delete and PII cards read the real
// Cedar denials (refusals-data.json), the circuit-breaker card reads the real
// scenario-2 trace, and the injection card reads injection-proof.json, computed
// from the real agent-shield detector against the real payload fixture. No card
// invents a value.
type ProofLink = { href: string; label: string; external?: boolean };
type ProofRow = { label: string; value: string };
type Proof = {
  asi: string;
  title: string;
  rows: ProofRow[];
  outcome: string;
  /** A secondary, complementary control shown beneath the primary outcome. */
  note?: string;
  links: ProofLink[];
};

function buildProofs(): Proof[] {
  const scene = (id: string) => {
    const s = refusalScenes.find((r) => r.id === id);
    if (!s) throw new Error(`missing refusal scene: ${id}`);
    return s;
  };
  const del = scene("delete-account");
  const pii = scene("pii-leak");

  const breaker = traceById("scenario-2");
  const breakerSpan = breaker?.spans.find((s) => s.kind === "breaker");
  const llmSpan = breaker?.spans.find((s) => s.kind === "llm");
  const ceiling = breaker?.costCeilingUsd ?? 0.5;
  const perCall = llmSpan?.costUsd ?? 0;

  return [
    {
      asi: del.asi,
      title: del.title,
      rows: [
        { label: "Policy", value: del.policyFile },
        { label: "Call", value: del.attempt },
      ],
      outcome: "Hard forbid. 0 actions executed, nothing dispatched.",
      links: [{ href: "/refusals", label: "Watch the refusal" }],
    },
    {
      // The primary injection defense: the agent-shield runtime detector scans
      // retrieved content and quarantines the payload before the planner sees
      // it. Cedar policy 02 is the complementary access-layer control, noted
      // beneath. Facts come from injection-proof.json (real detector output).
      asi: injectionProof.asi,
      title: "Indirect prompt injection",
      rows: [
        { label: "Control", value: "agent-shield injection detector" },
        { label: "Call", value: `getPage(${injectionProof.pageId})` },
        { label: "Signatures", value: injectionProof.signatures.join(", ") },
      ],
      outcome: "Quarantined before the planner. The agent still answers the real question.",
      note: "Defense in depth: Cedar policy 02 separately blocks internal-tagged SOP pages at the access layer.",
      links: [
        {
          href: `${REPO}/packages/agent-shield/src/injection/detector.ts`,
          label: "Detector source",
          external: true,
        },
        {
          href: `${REPO}/apps/agent/src/eval/asi-suite.ts#L20-L30`,
          label: "ASI01 eval",
          external: true,
        },
      ],
    },
    {
      asi: pii.asi,
      title: pii.title,
      rows: [
        { label: "Policy", value: pii.policyFile },
        { label: "Call", value: pii.attempt },
      ],
      outcome: "Default deny, then re-issued with redaction. Raw PII never reaches the model.",
      links: [{ href: "/refusals", label: "Watch the refusal" }],
    },
    {
      asi: "ASI09 Cost / Quota",
      title: breaker?.title ?? "Runaway loop, halted",
      rows: [
        { label: "Control", value: `circuit breaker · $${ceiling.toFixed(2)} ceiling` },
        { label: "Call", value: `model call per iteration · $${perCall.toFixed(2)} each` },
      ],
      outcome: breakerSpan?.detail ?? "",
      links: [{ href: "/traces/scenario-2", label: "Watch the trace" }],
    },
  ];
}

export default function Home() {
  const proofs = buildProofs();
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:px-10 md:py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
        Governed Support Ops Agent
      </p>
      <h1 className="mt-6 max-w-3xl text-balance text-5xl font-semibold leading-tight md:text-6xl">
        AI agents your security team will actually approve.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-text-secondary">
        For US tech companies past Series A that need agents, not chatbots.
      </p>
      <p className="mt-6 max-w-2xl text-base text-text-primary">
        This governs what the agent is allowed to do, not what it says. Every action is checked
        against policy before it runs, and logged after.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Cta href="/refusals" label="Watch a refusal" primary />
        <Cta href="/architecture" label="Read the architecture" />
        <Cta href="/run" label="Clone and run" />
      </div>

      <div className="mt-14">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          Four runs · the control that fired · the outcome
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {proofs.map((p) => (
            <ProofCard key={p.title} proof={p} />
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-text-secondary">
          Each one writes to the audit log running across the top of every page: the action, the
          policy decision, and the outcome.
        </p>
      </div>

      <div className="mt-12 rounded-lg border border-border bg-card p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          Two artifacts, one repo
        </p>
        <p className="mt-3 max-w-3xl text-text-primary">
          A runnable Governed Support Ops Agent, and{" "}
          <Link href="/shield" className="text-info hover:underline">
            <code className="font-mono">@sarthak/agent-shield</code>
          </Link>
          : the governance layer (Cedar policies, audit log, kill-switch, MCP scope check, circuit
          breaker) extracted from this demo as a standalone reference.
        </p>
      </div>
    </div>
  );
}

function Cta({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        primary
          ? "bg-text-primary text-base hover:bg-text-primary/90"
          : "border border-border text-text-primary hover:bg-card"
      }`}
    >
      {label}
    </Link>
  );
}

function ProofCard({ proof }: { proof: Proof }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">{proof.asi}</p>
      <h2 className="mt-2 text-lg font-semibold">{proof.title}</h2>
      <dl className="mt-4 space-y-2 text-sm">
        {proof.rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </dl>
      <p className="mt-4 text-sm text-text-primary">{proof.outcome}</p>
      {proof.note ? <p className="mt-2 text-xs text-text-secondary">{proof.note}</p> : null}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4">
        {proof.links.map((l) =>
          l.external ? (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-info hover:underline"
            >
              {l.label} ↗
            </a>
          ) : (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-xs text-info hover:underline"
            >
              {l.label} →
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className="text-right font-mono text-xs text-text-primary">{value}</dd>
    </div>
  );
}
