import { PageShell } from "../components/page-shell";

export default function PermissionsPage() {
  return (
    <PageShell
      eyebrow="Governance"
      title="Permissions"
      intro="Which role can run which tool action. Rows are roles, columns are tool actions, cells are allow, deny, or conditional, each backed by the policy that decides it."
    />
  );
}
