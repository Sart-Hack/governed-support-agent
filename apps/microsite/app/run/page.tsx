import { PageShell } from "../components/page-shell";

export default function RunPage() {
  return (
    <PageShell
      eyebrow="Reference"
      title="Clone and run"
      intro="The whole stack runs on your machine: clone, bring up the containers, play scenario one end to end. No live LLM endpoint to deploy, the demo replays recorded runs."
    />
  );
}
