"use client";

import { useState } from "react";
import type { ParsedPolicy } from "../lib/policies";
import { CedarCode } from "./cedar-code";

const EFFECT_STYLE: Record<ParsedPolicy["effect"], { dot: string; badge: string; label: string }> =
  {
    permit: {
      dot: "bg-success",
      badge: "border-success/40 text-success",
      label: "permit",
    },
    forbid: {
      dot: "bg-danger",
      badge: "border-danger/40 text-danger",
      label: "forbid",
    },
  };

export function PolicyViewer({ policies }: { policies: ParsedPolicy[] }) {
  const [activeId, setActiveId] = useState(policies[0]?.id ?? "");
  const active = policies.find((p) => p.id === activeId) ?? policies[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <ul className="flex shrink-0 gap-1 overflow-x-auto md:w-64 md:flex-col md:overflow-visible">
        {policies.map((policy) => {
          const selected = policy.id === active.id;
          const effect = EFFECT_STYLE[policy.effect];
          return (
            <li key={policy.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveId(policy.id)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-border bg-card"
                    : "border-transparent hover:border-border hover:bg-card/60"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${effect.dot}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text-primary">
                    <span className="text-text-secondary">{policy.num}</span> {policy.title}
                  </span>
                  <span className="font-mono text-[11px] text-text-secondary">{policy.asiId}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${EFFECT_STYLE[active.effect].badge}`}
          >
            {EFFECT_STYLE[active.effect].label}
          </span>
          <span className="rounded-full border border-policy/40 px-2.5 py-0.5 font-mono text-xs text-policy">
            {active.asiId} · {active.asiName}
          </span>
        </div>

        <p className="mt-4 max-w-2xl text-text-secondary">{active.description}</p>

        <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="font-mono text-xs text-text-secondary">
              packages/policies/policies/{active.filename}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-secondary/70">
              read-only
            </span>
          </div>
          <CedarCode source={active.text} />
        </div>
      </div>
    </div>
  );
}
