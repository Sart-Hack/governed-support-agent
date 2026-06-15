import { describe, expect, it } from "vitest";
import { LINKS, NODES, REPO, SHIELD_CHIPS, anchor, nodeById } from "./architecture";

describe("architecture diagram data", () => {
  it("includes the agent, all four MCP servers, Langfuse and Slack", () => {
    const ids = NODES.map((n) => n.id);
    for (const id of [
      "ingest",
      "policy-check",
      "execute",
      "zendesk",
      "notion",
      "hubspot",
      "github",
      "langfuse",
      "slack",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("marks github as the one real-API server", () => {
    expect(nodeById("github")?.real).toBe(true);
    expect(nodeById("zendesk")?.real).toBeFalsy();
  });

  it("links every repo deep link to the canonical repo", () => {
    const hrefs = [
      ...NODES.map((n) => n.href).filter((h): h is string => Boolean(h)),
      ...SHIELD_CHIPS.map((c) => c.href),
    ];
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      expect(href.startsWith(REPO)).toBe(true);
    }
  });

  it("exposes the five agent-shield controls as chips", () => {
    const labels = SHIELD_CHIPS.map((c) => c.label);
    expect(labels).toEqual([
      "Cedar policies",
      "Audit log",
      "Kill-switch",
      "Scope-check",
      "Circuit breaker",
    ]);
  });

  it("only links nodes that exist", () => {
    for (const link of LINKS) {
      expect(nodeById(link.from.id)).toBeDefined();
      expect(nodeById(link.to.id)).toBeDefined();
    }
  });

  it("computes edge anchors within the node bounds", () => {
    const n = NODES[0];
    if (!n) throw new Error("no nodes");
    expect(anchor(n, "right")).toEqual({ x: n.x + n.w, y: n.y + n.h / 2 });
    expect(anchor(n, "top")).toEqual({ x: n.x + n.w / 2, y: n.y });
  });
});
