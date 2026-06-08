import { PageShell } from "../components/page-shell";

export default function TrustPage() {
  return (
    <PageShell
      eyebrow="Disclosure"
      title="Trust"
      intro="Honest by default: the actions this agent will never automate, the model versions it runs, the prompt revision in force, current eval pass rates, and the last 24 hours of spend."
    />
  );
}
