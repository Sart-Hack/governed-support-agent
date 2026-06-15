"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Span,
  type Trace,
  clockAt,
  costPoints,
  playbackSpans,
  spanDepth,
  totalCostUsd,
  totalDurMs,
} from "../lib/trace";

const KIND_DOT: Record<Span["kind"], string> = {
  run: "bg-text-secondary",
  step: "bg-info",
  llm: "bg-policy",
  tool: "bg-info",
  policy: "bg-approval",
  breaker: "bg-danger",
};

const BAR_COLOR: Record<Span["kind"], string> = {
  run: "bg-text-secondary/30",
  step: "bg-info/30",
  llm: "bg-policy/60",
  tool: "bg-info/60",
  policy: "bg-approval/60",
  breaker: "bg-danger/70",
};

const STEP_MS = 750;

export function TraceViewer({ trace }: { trace: Trace }) {
  const steps = useMemo(() => playbackSpans(trace), [trace]);
  const total = useMemo(() => totalDurMs(trace), [trace]);
  const [cursor, setCursor] = useState(steps.length - 1); // start fully revealed
  const [playing, setPlaying] = useState(false);

  const atEnd = cursor >= steps.length - 1;

  // While playing, advance one span per tick; the interval caps the cursor at the
  // last span. A separate effect stops playback once we reach the end.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setCursor((c) => Math.min(c + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, [playing, steps.length]);

  useEffect(() => {
    if (atEnd) setPlaying(false);
  }, [atEnd]);

  const play = useCallback(() => {
    if (atEnd) setCursor(0);
    setPlaying(true);
  }, [atEnd]);

  const activeMs = steps[cursor]?.startMs ?? 0;
  const revealedCost = steps.slice(0, cursor + 1).reduce((sum, s) => sum + (s.costUsd ?? 0), 0);

  return (
    <div>
      <CostOverlay trace={trace} cursorMs={activeMs} revealedCost={revealedCost} />

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[minmax(11rem,1.2fr)_2fr] border-b border-border bg-card/40 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          <span>Span</span>
          <span>Timeline · {total} ms</span>
        </div>
        {steps.map((span, i) => (
          <SpanRow
            key={span.id}
            trace={trace}
            span={span}
            total={total}
            state={i < cursor ? "done" : i === cursor ? "active" : "future"}
          />
        ))}
      </div>

      <Controls
        cursor={cursor}
        count={steps.length}
        playing={playing}
        clock={clockAt(trace, activeMs)}
        onPlay={play}
        onPause={() => setPlaying(false)}
        onSeek={(v) => {
          setPlaying(false);
          setCursor(v);
        }}
      />
    </div>
  );
}

function SpanRow({
  trace,
  span,
  total,
  state,
}: {
  trace: Trace;
  span: Span;
  total: number;
  state: "done" | "active" | "future";
}) {
  const depth = spanDepth(trace, span) - 1; // root excluded from the list
  const left = (span.startMs / total) * 100;
  const width = Math.max((span.durMs / total) * 100, 1.5);
  const dim = state === "future" ? "opacity-30" : "opacity-100";
  const ring = state === "active" ? "bg-card/60" : "";

  return (
    <div
      className={`grid grid-cols-[minmax(11rem,1.2fr)_2fr] items-center border-b border-border/60 px-4 py-2 transition-opacity last:border-0 ${dim} ${ring}`}
    >
      <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${depth * 14}px` }}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[span.kind]}`} aria-hidden />
        <span className="truncate font-mono text-sm text-text-primary">{span.name}</span>
        <span className="shrink-0 font-mono text-[11px] text-text-secondary/70">{span.source}</span>
      </div>

      <div className="min-w-0">
        <div className="relative h-5">
          <div className="absolute inset-y-0 left-0 right-0 rounded bg-border/30" aria-hidden />
          <div
            className={`absolute inset-y-0 rounded ${BAR_COLOR[span.kind]}`}
            style={{ left: `${left}%`, width: `${width}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-secondary">
          {span.detail ? <span className="truncate">{span.detail}</span> : null}
          {span.decision ? <DecisionBadge span={span} /> : null}
          {span.costUsd ? <span className="text-policy">${span.costUsd.toFixed(4)}</span> : null}
          {span.halted ? <span className="text-danger">halted</span> : null}
          {span.ok ? <span className="text-success">ok</span> : null}
        </div>
      </div>
    </div>
  );
}

function DecisionBadge({ span }: { span: Span }) {
  const color =
    span.decision === "deny"
      ? "text-danger"
      : span.decision === "needs-approval"
        ? "text-approval"
        : "text-success";
  return (
    <span className={color}>
      {span.decision} · {span.policyId}
    </span>
  );
}

function CostOverlay({
  trace,
  cursorMs,
  revealedCost,
}: {
  trace: Trace;
  cursorMs: number;
  revealedCost: number;
}) {
  const total = totalDurMs(trace);
  const ceiling = trace.costCeilingUsd;
  const points = costPoints(trace);
  const yMax = Math.max(ceiling * 1.1, totalCostUsd(trace) * 1.1, 0.001);

  const W = 1000;
  const H = 120;
  const x = (ms: number) => (ms / total) * W;
  const y = (usd: number) => H - (usd / yMax) * H;
  const ceilingY = y(ceiling);

  // Stepwise cumulative-cost path: flat at the previous total, then a vertical
  // jump at each billed span.
  let d = `M 0 ${H}`;
  let prevCum = 0;
  for (const p of points) {
    const px = x(p.ms);
    d += ` L ${px} ${y(prevCum)} L ${px} ${y(p.cumUsd)}`;
    prevCum = p.cumUsd;
  }
  d += ` L ${W} ${y(prevCum)}`;

  const crossed = revealedCost >= ceiling;

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          Cumulative cost
        </p>
        <p className="font-mono text-sm">
          <span className={crossed ? "text-danger" : "text-text-primary"}>
            ${revealedCost.toFixed(4)}
          </span>
          <span className="text-text-secondary"> / ${ceiling.toFixed(2)} ceiling</span>
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 h-28 w-full"
        role="img"
        aria-label="Cumulative cost against the circuit-breaker ceiling"
      >
        <title>Cumulative cost against the circuit-breaker ceiling</title>
        {/* Ceiling line */}
        <line
          x1={0}
          x2={W}
          y1={ceilingY}
          y2={ceilingY}
          className="stroke-danger"
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
        {/* Full cost curve, faint */}
        <path d={d} className="fill-none stroke-policy/40" strokeWidth={2} />
        {/* Revealed portion up to the playback cursor */}
        <clipPath id={`reveal-${trace.id}`}>
          <rect x={0} y={0} width={Math.max(x(cursorMs), 1)} height={H} />
        </clipPath>
        <path
          d={d}
          className="fill-none stroke-policy"
          strokeWidth={2.5}
          clipPath={`url(#reveal-${trace.id})`}
        />
        {/* Playback cursor */}
        <line
          x1={x(cursorMs)}
          x2={x(cursorMs)}
          y1={0}
          y2={H}
          className="stroke-text-secondary"
          strokeWidth={1}
        />
      </svg>
      <p className="mt-1 font-mono text-[11px] text-text-secondary">
        The dashed line is the $0.50 circuit-breaker ceiling. The breaker halts the run the moment
        the curve reaches it.
      </p>
    </div>
  );
}

function Controls({
  cursor,
  count,
  playing,
  clock,
  onPlay,
  onPause,
  onSeek,
}: {
  cursor: number;
  count: number;
  playing: boolean;
  clock: string;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (v: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="flex items-center gap-1">
        <CtlButton label="Step back" disabled={cursor <= 0} onClick={() => onSeek(cursor - 1)}>
          ◀
        </CtlButton>
        {playing ? (
          <CtlButton label="Pause" onClick={onPause}>
            ⏸
          </CtlButton>
        ) : (
          <CtlButton label="Play" onClick={onPlay}>
            ▶
          </CtlButton>
        )}
        <CtlButton
          label="Step forward"
          disabled={cursor >= count - 1}
          onClick={() => onSeek(cursor + 1)}
        >
          ▶
        </CtlButton>
      </div>

      <input
        type="range"
        min={0}
        max={count - 1}
        value={cursor}
        aria-label="Scrub the trace"
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-border accent-info"
      />

      <span className="shrink-0 font-mono text-xs text-text-secondary">
        {clock} · {cursor + 1}/{count}
      </span>
    </div>
  );
}

function CtlButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded border border-border font-mono text-xs text-text-primary transition-colors hover:bg-card disabled:opacity-30"
    >
      {children}
    </button>
  );
}
