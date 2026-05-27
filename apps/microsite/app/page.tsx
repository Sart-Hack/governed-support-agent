export default function Home() {
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
        Governed Support Ops Agent
      </p>
      <h1 className="mt-6 max-w-3xl text-balance text-5xl font-semibold leading-tight md:text-6xl">
        AI agents your security team will actually approve.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-text-secondary">
        For US tech companies past Series A that need agents, not chatbots.
      </p>
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
    </main>
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
