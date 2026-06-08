import { PageShell } from "../components/page-shell";

export default function PoliciesPage() {
  return (
    <PageShell
      eyebrow="Governance"
      title="Policies"
      intro="The Cedar policies the agent enforces, read straight from the repo. One policy per tab, each mapped to an OWASP Agentic Top 10 threat ID."
    />
  );
}
