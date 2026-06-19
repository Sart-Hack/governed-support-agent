import { CodeBlock } from "../components/code-block";
import { PageShell } from "../components/page-shell";

const REPO = "https://github.com/Sart-Hack/governed-support-agent";

const STEPS = [
  {
    n: "01",
    title: "Clone",
    body: "Apple Silicon and x86 Linux are both supported. You need Docker and pnpm.",
    caption: "shell",
    code: `git clone ${REPO}.git
cd governed-support-agent
pnpm install`,
  },
  {
    n: "02",
    title: "Bring up the stack",
    body: "Postgres, Langfuse, Bifrost, and the four MCP mock servers come up in containers. The verify step waits for every healthcheck before returning.",
    caption: "shell",
    code: `pnpm stack:up
pnpm stack:verify`,
  },
  {
    n: "03",
    title: "Play a scenario",
    body: "Run scenario one end to end through the governed workflow. The Cedar checks, audit log, and OTel trace are real; the trace lands in Langfuse on localhost:3001.",
    caption: "shell",
    code: `pnpm demo          # scenario 1 (TCK-1)
pnpm demo TCK-5    # the delete-account refusal`,
  },
];

export default function RunPage() {
  return (
    <PageShell
      eyebrow="Reference"
      title="Clone and run"
      intro="The whole stack runs on your machine: clone, bring up the containers, play scenario one end to end. There is no live LLM endpoint in the deployed site; the agent runs here, and the deployed pages render captured traces and live Cedar decisions from those runs."
    >
      <ol className="space-y-8">
        {STEPS.map((step) => (
          <li key={step.n} className="grid gap-4 md:grid-cols-[3rem_1fr] md:gap-6">
            <span className="font-mono text-sm text-text-secondary/70">{step.n}</span>
            <div>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">{step.body}</p>
              <div className="mt-3">
                <CodeBlock code={step.code} caption={step.caption} />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-lg border border-border bg-card/40 p-5">
        <p className="text-sm text-text-secondary">
          Five minutes after the clone, a peer engineer can answer the question this whole repo is
          built around: what does this agent refuse to do, and why?
        </p>
        <a
          href={REPO}
          className="mt-3 inline-flex font-mono text-sm text-info hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {REPO} →
        </a>
      </div>
    </PageShell>
  );
}
