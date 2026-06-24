import { CodeBlock } from "../components/code-block";
import { PageShell } from "../components/page-shell";

const WRAP_SNIPPET = `import { shield } from "@sarthak/agent-shield";

const guard = shield({
  policies,    // Cedar policies, evaluated on every tool call
  audit,       // append-only audit sink
  killSwitch,  // halts an in-flight run within 1s
  scopeCheck,  // MCP scope discovery + step-up auth
  breaker,     // circuit breaker on a cost ceiling
});

// Wrap a workflow step. The five controls run around it; the
// step body stays unchanged.
const governedStep = guard.wrap(step);`;

// The five controls are the real keys of ShieldConfig in packages/agent-shield.
// Each line below maps to one constructor argument the agent passes in.
const CONTROLS = [
  {
    key: "policies",
    title: "Cedar policy engine",
    body: "The same policies in version control, evaluated on every tool call. A deny returns a human-readable reason chain via formatDecision(), not a boolean.",
  },
  {
    key: "audit",
    title: "Append-only audit log",
    body: "Every step and tool call is recorded with its policy decision attached. Exportable and queryable; it backs the audit strip on this site.",
  },
  {
    key: "killSwitch",
    title: "Kill switch",
    body: "A single flip halts an in-flight run within one second, before the next tool call leaves the process.",
  },
  {
    key: "scopeCheck",
    title: "MCP scope check",
    body: "Checks the scopes a tool requires against what the principal holds, using the spec-native WWW-Authenticate step-up flow (SEP-2350), not a custom header.",
  },
  {
    key: "breaker",
    title: "Circuit breaker",
    body: "Trips when cumulative spend crosses a cost ceiling (0.50 USD by default), stopping a runaway loop before it bills.",
  },
];

// The real source layout, so a reader can open the files directly. These are the
// actual directories under packages/agent-shield/src plus the policy files the
// agent enforces, not a sketch.
const STRUCTURE = [
  {
    path: "packages/policies/policies/*.cedar",
    body: "The eight Cedar policies, the same files the agent enforces and the /policies page renders.",
  },
  {
    path: "agent-shield/src/policy/",
    body: "Cedar evaluation plus formatDecision(), which turns a deny into a human-readable reason chain.",
  },
  {
    path: "agent-shield/src/audit/",
    body: "The append-only audit sink and the event shapes the agent emits.",
  },
  {
    path: "agent-shield/src/kill-switch/",
    body: "The per-step kill-switch check the wrap() boundary polls.",
  },
  {
    path: "agent-shield/src/scope-check/",
    body: "MCP scope discovery and the WWW-Authenticate step-up flow (SEP-2350).",
  },
  {
    path: "agent-shield/src/circuit-breaker/",
    body: "The cost-ceiling and duplicate-call breaker that halts a runaway loop.",
  },
  {
    path: "agent-shield/src/injection/",
    body: "The detector that scans untrusted retrieved content and quarantines it before the planner (ASI01).",
  },
  {
    path: "agent-shield/src/transform/",
    body: "The PII-redaction transform applied to reads a policy only permits when redacted (policy 03).",
  },
];

export default function ShieldPage() {
  return (
    <PageShell
      eyebrow="Library"
      title="agent-shield"
      intro="The governance layer this agent runs on, lifted out of the demo so you can read it on its own: Cedar policies, an append-only audit log, a kill-switch, an MCP scope check, and a circuit breaker, composed behind one wrap() call. This is the reference extraction from the demo, not a product to adopt. The agent in this repo is its only integration."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={WRAP_SNIPPET} caption="the public API shape" />
        <div className="flex flex-col justify-center">
          <p className="text-sm text-text-secondary">
            One function in, one wrapped step out. The agent in this repo is the reference
            integration: it passes its real Cedar policies, its Postgres-backed audit sink, and a
            0.50 USD circuit breaker into the same call shown here. Read the layer in{" "}
            <code className="font-mono text-text-primary">packages/agent-shield/</code> and the
            policies it enforces in{" "}
            <code className="font-mono text-text-primary">packages/policies/</code>.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          The five controls
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {CONTROLS.map((c) => (
            <div key={c.key} className="rounded-lg border border-border bg-card/40 p-5">
              <p className="font-mono text-sm text-policy">{c.key}</p>
              <h2 className="mt-1 text-base font-semibold">{c.title}</h2>
              <p className="mt-2 text-sm text-text-secondary">{c.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          How the layer is structured
        </p>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          The policies it enforces, plus seven modules behind the one wrap() call. Each is here in
          the repo to read; nothing is hidden behind a package boundary.
        </p>
        <div className="mt-4 grid gap-3">
          {STRUCTURE.map((s) => (
            <div
              key={s.path}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 p-4 md:flex-row md:items-baseline md:gap-4"
            >
              <code className="shrink-0 font-mono text-xs text-policy">{s.path}</code>
              <p className="text-sm text-text-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
