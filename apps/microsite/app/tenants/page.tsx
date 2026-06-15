import { CedarCode } from "../components/cedar-code";
import { PageShell } from "../components/page-shell";
import { TenantProofPanel } from "../components/tenant-proof";
import { tenantProof } from "../lib/tenants-data";

const POLICY_07 = `@id("07-tenant-isolation")
@asi("ASI06 Inter-Agent / Cross-Boundary")
forbid ( principal, action, resource )
when {
  principal has tenant && resource has tenant
  && principal.tenant != resource.tenant
};`;

export default function TenantsPage() {
  return (
    <PageShell
      eyebrow="Disclosure"
      title="Tenants"
      intro="Principal-bound isolation, proven. Policy 07 permits an action only when the principal's tenant matches the resource's tenant. A tenant-A call against tenant-B data is denied with the reason chain shown."
    >
      <TenantProofPanel proof={tenantProof} />

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          The policy that decides
        </p>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          One forbid rule, enforced on every tool call. There is no allow-list of tenant pairs to
          maintain; the crossing itself is what the policy denies.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card/40">
          <CedarCode source={POLICY_07} />
        </div>
      </div>
    </PageShell>
  );
}
