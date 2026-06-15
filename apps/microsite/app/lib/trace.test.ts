import { describe, expect, it } from "vitest";
import {
  type Trace,
  clockAt,
  costPoints,
  playbackSpans,
  spanDepth,
  totalCostUsd,
  totalDurMs,
  traceById,
  traceIds,
} from "./trace";

const traces = traceIds().map((id) => traceById(id) as Trace);

describe("trace data integrity", () => {
  it("has at least the two demo traces", () => {
    expect(traceIds()).toEqual(expect.arrayContaining(["scenario-1", "scenario-2"]));
  });

  for (const trace of traces) {
    describe(trace.id, () => {
      it("has exactly one root run span", () => {
        const roots = trace.spans.filter((s) => s.parentId === null);
        expect(roots).toHaveLength(1);
        expect(roots[0]?.kind).toBe("run");
      });

      it("every non-root span points at a real parent", () => {
        const ids = new Set(trace.spans.map((s) => s.id));
        for (const s of trace.spans) {
          if (s.parentId !== null) expect(ids.has(s.parentId)).toBe(true);
        }
      });

      it("playback spans are ordered by start time", () => {
        const starts = playbackSpans(trace).map((s) => s.startMs);
        expect(starts).toEqual([...starts].sort((a, b) => a - b));
      });

      it("every child fits inside its parent's time window", () => {
        const byId = new Map(trace.spans.map((s) => [s.id, s]));
        for (const s of trace.spans) {
          if (!s.parentId) continue;
          const p = byId.get(s.parentId);
          if (!p) continue;
          expect(s.startMs).toBeGreaterThanOrEqual(p.startMs);
          expect(s.startMs + s.durMs).toBeLessThanOrEqual(p.startMs + p.durMs + 1);
        }
      });

      it("cumulative cost is monotonic and matches the total", () => {
        const points = costPoints(trace);
        for (let i = 1; i < points.length; i++) {
          expect(points[i]!.cumUsd).toBeGreaterThanOrEqual(points[i - 1]!.cumUsd);
        }
        const last = points.at(-1)?.cumUsd ?? 0;
        expect(last).toBeCloseTo(totalCostUsd(trace), 6);
      });
    });
  }

  it("scenario 1 stays well under the ceiling", () => {
    const t = traceById("scenario-1") as Trace;
    expect(totalCostUsd(t)).toBeLessThan(t.costCeilingUsd);
    expect(totalCostUsd(t)).toBeLessThan(0.01);
  });

  it("scenario 2 crosses the ceiling and ends in a breaker trip", () => {
    const t = traceById("scenario-2") as Trace;
    expect(totalCostUsd(t)).toBeGreaterThanOrEqual(t.costCeilingUsd);
    expect(t.spans.some((s) => s.kind === "breaker" && s.halted)).toBe(true);
  });

  it("spanDepth and clockAt behave", () => {
    const t = traceById("scenario-1") as Trace;
    const root = t.spans.find((s) => s.id === "run") as Trace["spans"][number];
    const leaf = t.spans.find((s) => s.id === "ingest.get") as Trace["spans"][number];
    expect(spanDepth(t, root)).toBe(0);
    expect(spanDepth(t, leaf)).toBe(2);
    expect(clockAt(t, 0)).toBe("14:02:31");
    expect(clockAt(t, 4000)).toBe("14:02:35");
    expect(totalDurMs(t)).toBe(4000);
  });
});
