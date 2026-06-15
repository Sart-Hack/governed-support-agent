import { PageShell } from "../components/page-shell";
import { PolicyViewer } from "../components/policy-viewer";
import { getPolicies } from "../lib/policies";

export default function PoliciesPage() {
  const policies = getPolicies();
  return (
    <PageShell
      eyebrow="Governance"
      title="Policies"
      intro={`The ${policies.length} Cedar policies the agent enforces, read straight from the repo. One policy per tab, each mapped to an OWASP Agentic Top 10 threat ID.`}
    >
      <PolicyViewer policies={policies} />
    </PageShell>
  );
}
