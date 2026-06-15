import type { Cell, CellState, Matrix } from "../lib/permissions";

const CELL_STYLE: Record<CellState, { glyph: string; className: string; label: string }> = {
  allow: { glyph: "✓", className: "text-success", label: "allow" },
  conditional: { glyph: "◑", className: "text-approval", label: "conditional" },
  deny: { glyph: "✕", className: "text-danger", label: "deny" },
};

function cellTitle(cell: Cell): string {
  if (cell.state === "deny") {
    return cell.policyId === "default-deny"
      ? "deny · no matching permit (default deny)"
      : `forbid · policy ${cell.policyNum} · ${cell.asi}`;
  }
  const effect = cell.state === "conditional" ? "permit when condition holds" : "permit";
  return `${effect} · policy ${cell.policyNum} · ${cell.asi}`;
}

function CellPill({ cell }: { cell: Cell }) {
  const style = CELL_STYLE[cell.state];
  return (
    <span
      title={cellTitle(cell)}
      className={`inline-flex items-center gap-1.5 font-mono text-sm ${style.className}`}
    >
      <span aria-hidden>{style.glyph}</span>
      <span className="text-text-secondary">{cell.policyNum || "—"}</span>
    </span>
  );
}

export function PermissionMatrix({ matrix }: { matrix: Matrix }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-text-secondary">
                Tool action
              </th>
              {matrix.roles.map((role) => (
                <th
                  key={role}
                  className="px-4 py-2.5 text-right font-mono text-xs uppercase tracking-widest text-text-secondary"
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((group) => (
              <GroupRows key={group.server} group={group} roleCount={matrix.roles.length} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
        <Legend glyph="✓" className="text-success" text="allow" />
        <Legend
          glyph="◑"
          className="text-approval"
          text="conditional — permitted only when the policy condition holds"
        />
        <Legend glyph="✕" className="text-danger" text="deny" />
        <span className="font-mono text-xs">
          number = deciding policy · hover a cell for the ASI mapping
        </span>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  roleCount,
}: {
  group: Matrix["groups"][number];
  roleCount: number;
}) {
  return (
    <>
      <tr className="border-b border-border bg-card/40">
        <td
          colSpan={roleCount + 1}
          className="px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-text-secondary/80"
        >
          {group.server} · {group.resourceType}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.action} className="border-b border-border/60 last:border-0">
          <td className="px-4 py-2.5 font-mono text-sm text-text-primary">{row.action}</td>
          {row.cells.map((cell, i) => (
            <td
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional by role
              key={i}
              className="px-4 py-2.5 text-right"
            >
              <CellPill cell={cell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Legend({ glyph, className, text }: { glyph: string; className: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`font-mono ${className}`} aria-hidden>
        {glyph}
      </span>
      {text}
    </span>
  );
}
