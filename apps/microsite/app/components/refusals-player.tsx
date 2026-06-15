"use client";

import { useEffect, useMemo, useState } from "react";
import { REPO } from "../lib/architecture";
import type { RefusalFrame, RefusalScene } from "../lib/refusals";

const TONE: Record<RefusalFrame["tone"], string> = {
  info: "text-text-primary",
  muted: "text-text-secondary",
  danger: "text-danger",
  success: "text-success",
};

const STEP_MS = 850;

export function RefusalsPlayer({ scenes }: { scenes: RefusalScene[] }) {
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {scenes.map((s) => {
          const active = s.id === scene?.id;
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => setSceneId(s.id)}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                active
                  ? "border-danger bg-danger/10 text-text-primary"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {s.ticket} · {s.title}
            </button>
          );
        })}
      </div>

      {scene ? <Scene key={scene.id} scene={scene} /> : null}
    </div>
  );
}

function Scene({ scene }: { scene: RefusalScene }) {
  const verdictIndex = useMemo(() => scene.frames.findIndex((f) => f.verdict), [scene]);
  const [cursor, setCursor] = useState(scene.frames.length - 1);
  const [playing, setPlaying] = useState(false);
  const atEnd = cursor >= scene.frames.length - 1;
  const revealed = cursor >= verdictIndex;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () => setCursor((c) => Math.min(c + 1, scene.frames.length - 1)),
      STEP_MS,
    );
    return () => clearInterval(t);
  }, [playing, scene.frames.length]);

  useEffect(() => {
    if (atEnd) setPlaying(false);
  }, [atEnd]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">{scene.intent}</p>
        <span className="shrink-0 rounded border border-border px-2 py-0.5 font-mono text-[11px] text-text-secondary">
          {scene.asi}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Transcript scene={scene} cursor={cursor} />
        <Verdict scene={scene} revealed={revealed} />
      </div>

      <Controls
        cursor={cursor}
        count={scene.frames.length}
        playing={playing}
        onPlay={() => {
          if (atEnd) setCursor(0);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onSeek={(v) => {
          setPlaying(false);
          setCursor(v);
        }}
      />
    </div>
  );
}

function Transcript({ scene, cursor }: { scene: RefusalScene; cursor: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-base/60">
      <div className="border-b border-border bg-card/40 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        Agent · proposed {scene.attempt}
      </div>
      <ol className="divide-y divide-border/50">
        {scene.frames.map((f, i) => (
          <li
            key={`${f.at}-${f.source}-${i}`}
            className={`flex gap-3 px-4 py-2.5 font-mono text-[13px] transition-opacity ${
              i > cursor ? "opacity-25" : "opacity-100"
            } ${f.verdict ? "bg-danger/5" : ""}`}
          >
            <span className="shrink-0 text-text-secondary/60">{f.at}</span>
            <span className="w-24 shrink-0 text-text-secondary/80">{f.source}</span>
            <span className={TONE[f.tone]}>{f.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Verdict({ scene, revealed }: { scene: RefusalScene; revealed: boolean }) {
  if (!revealed) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card/40 p-6">
        <p className="font-mono text-sm text-text-secondary">evaluating policy…</p>
      </div>
    );
  }

  const kindLabel = scene.denialKind === "forbid" ? "hard forbid" : "default deny";
  return (
    <div className="rounded-lg border border-danger/50 bg-danger/5 p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-danger">DENY</span>
        <span className="font-mono text-[11px] text-text-secondary">{kindLabel}</span>
      </div>

      <p className="mt-3 text-sm text-text-primary">{scene.formatted.summary}</p>

      {scene.formatted.reasonLines.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {scene.formatted.reasonLines.map((line) => (
            <li key={line} className="font-mono text-xs text-text-secondary">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
          {scene.asi}
        </span>
        <a
          href={`${REPO}/packages/policies/policies/${scene.policyFile}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[11px] text-info hover:underline"
        >
          {scene.policyFile} →
        </a>
      </div>

      {scene.defenseInDepth ? (
        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-text-secondary">
          {scene.defenseInDepth}
        </p>
      ) : null}
    </div>
  );
}

function Controls({
  cursor,
  count,
  playing,
  onPlay,
  onPause,
  onSeek,
}: {
  cursor: number;
  count: number;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (v: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="flex items-center gap-1">
        <Btn label="Step back" disabled={cursor <= 0} onClick={() => onSeek(cursor - 1)}>
          ◀
        </Btn>
        {playing ? (
          <Btn label="Pause" onClick={onPause}>
            ⏸
          </Btn>
        ) : (
          <Btn label="Play" onClick={onPlay}>
            ▶
          </Btn>
        )}
        <Btn label="Step forward" disabled={cursor >= count - 1} onClick={() => onSeek(cursor + 1)}>
          ▶
        </Btn>
      </div>
      <input
        type="range"
        min={0}
        max={count - 1}
        value={cursor}
        aria-label="Scrub the refusal scene"
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-border accent-danger"
      />
      <span className="shrink-0 font-mono text-xs text-text-secondary">
        {cursor + 1}/{count}
      </span>
    </div>
  );
}

function Btn({
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
