import Link from "next/link";

export default function Home() {
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

      <div className="mt-10 flex flex-wrap gap-3">
        <Cta href="/refusals" label="Watch a refusal" primary />
        <Cta href="/architecture" label="Read the architecture" />
        <Cta href="/run" label="Clone and run" />
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <Card
          title="Scoped access"
          body="Least-privilege by default. Every agent only sees what it needs."
        />
        <Card
          title="Full audit trail"
          body="Every action logged. Tool calls, inputs, outputs, approvers."
        />
        <Card
          title="Human in the loop"
          body="Approval gates on anything risky. Your team approves. Always."
        />
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
          breaker) extracted as a drop-in library.
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

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-secondary">{title}</h2>
      <p className="mt-3 text-text-primary">{body}</p>
    </div>
  );
}
