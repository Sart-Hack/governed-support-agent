import { PageShell } from "../components/page-shell";
import { RefusalsPlayer } from "../components/refusals-player";
import { refusalScenes } from "../lib/refusals-data";

export default function RefusalsPage() {
  return (
    <PageShell
      eyebrow="Demo"
      title="Refusals"
      intro="What the agent will not do, in motion. Each scene replays a run where the agent proposes an action and the Cedar engine denies it. The verdict and reason chain are real evaluations, not a recording: delete account, indirect injection, PII leak, cross-tenant read."
    >
      <RefusalsPlayer scenes={refusalScenes} />
    </PageShell>
  );
}
