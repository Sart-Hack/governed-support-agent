import type { TenantProof, TenantScenario } from "../lib/tenants";

// Two real Cedar decisions side by side. The requests are identical except for the
// resource tenant, so the deny on the right is attributable to exactly one thing:
// policy 07. The reason chain and ASI mapping come straight from formatDecision().

const DECISION_STYLE = {
  allow: { label: "PERMIT", className: "text-success", border: "border-success/40" },
  deny: { label: "DENY", className: "text-danger", border: "border-danger/50" },
} as const;

export function TenantProofPanel({ proof }: { proof: TenantProof }) {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {proof.scenarios.map((s) => (
          <ScenarioCard key={s.key} scenario={s} />
        ))}
      </div>
      <p className="mt-5 font-mono text-xs text-text-secondary">
        Both decisions are evaluated through agent-shield against the same policy 07 the agent
        enforces. Only the resource tenant differs between the two requests.
      </p>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: TenantScenario }) {
  const style = DECISION_STYLE[scenario.decision];
  return (
    <div className={`rounded-lg border ${style.border} bg-card/40 p-5`}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          {scenario.title}
        </p>
        <span className={`font-mono text-xs font-semibold ${style.className}`}>{style.label}</span>
      </div>

      <dl className="mt-4 space-y-1.5 font-mono text-sm">
        <Row label="principal" value={`tenant = ${scenario.principalTenant}`} />
        <Row label="action" value={scenario.action} />
        <Row
          label="resource"
          value={`${scenario.resource.id} · tenant = ${scenario.resource.tenant}`}
        />
      </dl>

      <p className="mt-4 text-sm text-text-secondary">{scenario.caption}</p>

      <div className="mt-4 rounded-md border border-border bg-base/60 p-3">
        <p className={`text-sm ${style.className}`}>{scenario.formatted.summary}</p>
        {scenario.formatted.reasonLines.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {scenario.formatted.reasonLines.map((line) => (
              <li key={line} className="font-mono text-xs text-text-secondary">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        {scenario.formatted.asiIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {scenario.formatted.asiIds.map((asi) => (
              <span
                key={asi}
                className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-text-secondary"
              >
                {asi}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-text-secondary/70">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
