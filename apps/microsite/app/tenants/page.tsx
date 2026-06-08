import { PageShell } from "../components/page-shell";

export default function TenantsPage() {
  return (
    <PageShell
      eyebrow="Disclosure"
      title="Tenants"
      intro="Principal-bound isolation, proven. Policy 07 permits an action only when the principal's tenant matches the resource's tenant. A tenant-A call against tenant-B data is denied with the reason chain shown."
    />
  );
}
