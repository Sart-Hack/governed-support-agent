import { PageShell } from "../components/page-shell";
import { PermissionMatrix } from "../components/permission-matrix";
import { permissionMatrix } from "../lib/permissions-data";

export default function PermissionsPage() {
  const matrix = permissionMatrix;
  return (
    <PageShell
      eyebrow="Governance"
      title="Permissions"
      intro="Which role can run which tool action. Every cell is a live Cedar decision from the policies the agent enforces, evaluated through agent-shield, not a hand-drawn grid."
    >
      <PermissionMatrix matrix={matrix} />
    </PageShell>
  );
}
