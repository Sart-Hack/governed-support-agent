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

// Wrap any workflow step. The five controls run around it; your
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

export default function ShieldPage() {
  return (
    <PageShell
      eyebrow="Library"
      title="agent-shield"
      intro="The governance layer this agent runs on, extracted as a drop-in library: Cedar policies, append-only audit log, kill-switch, MCP scope check, and circuit breaker behind one wrap() call for any MCP-based agent."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={WRAP_SNIPPET} caption="the whole public API" />
        <div className="flex flex-col justify-center">
          <p className="text-sm text-text-secondary">
            One function in, one wrapped step out. The agent in this repo is the reference
            integration: it passes its real Cedar policies, its Postgres-backed audit sink, and a
            0.50 USD circuit breaker into the same call shown here.
          </p>
          <div className="mt-4">
            <CodeBlock code="pnpm add @sarthak/agent-shield" caption="install" />
          </div>
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
    </PageShell>
  );
}
