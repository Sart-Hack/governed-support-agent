"use client";

import { useEffect, useState } from "react";
import { AUDIT_SAMPLE, TONE_DOT } from "../lib/audit-sample";

// Persistent top-of-page strip: advances through the recorded audit stream one
// event at a time. Starts at index 0 so server and client render the same first
// frame (no hydration mismatch), then ticks forward on an interval.
export function AuditStrip() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % AUDIT_SAMPLE.length);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const event = AUDIT_SAMPLE[index];
  if (!event) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-base px-5 font-mono text-xs">
      <span className="hidden uppercase tracking-widest text-text-secondary/70 sm:inline">
        Audit
      </span>
      <span className="h-3 w-px bg-border" aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[event.tone]}`} aria-hidden />
        <span className="shrink-0 text-text-secondary">{event.time}</span>
        <span className="shrink-0 text-text-secondary">{event.source}</span>
        <span className="shrink-0 text-text-primary">{event.kind}</span>
        <span className="truncate text-text-secondary">{event.detail}</span>
      </div>
      <span className="hidden shrink-0 items-center gap-1.5 text-text-secondary/70 md:flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />
        recorded run
      </span>
    </div>
  );
}
