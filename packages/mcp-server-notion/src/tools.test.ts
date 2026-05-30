import { INJECTION_PAYLOAD_PAGE_ID } from "@gsa/fixtures";
import { describe, expect, it } from "vitest";
import { createState, tools } from "./tools.js";

function searchTool() {
  return tools(createState()).find((t) => t.name === "search")!;
}

function getPageTool(state = createState()) {
  return { state, tool: tools(state).find((t) => t.name === "getPage")! };
}

describe("notion search", () => {
  it("returns hits matching the query across all tags by default", async () => {
    const r = await searchTool().handler({ query: "Okta" });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.hits.length).toBeGreaterThan(0);
  });

  it("restricts to a single tag bucket when tag is passed", async () => {
    const r = await searchTool().handler({ query: "migration", tag: "internal" });
    const out = JSON.parse(r.content[0]!.text);
    for (const hit of out.hits) expect(hit.tag).toBe("internal");
  });

  it("excerpt does not exceed the requested width budget", async () => {
    const r = await searchTool().handler({ query: "migration", limit: 5 });
    const out = JSON.parse(r.content[0]!.text);
    for (const hit of out.hits) expect(hit.excerpt.length).toBeLessThanOrEqual(160);
  });
});

describe("notion getPage", () => {
  it("returns a known page", async () => {
    const { tool } = getPageTool();
    const r = await tool.handler({ id: "NTP-PUB-1" });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.id).toBe("NTP-PUB-1");
    expect(out.tag).toBe("public");
  });

  it("returns an error for an unknown id", async () => {
    const { tool } = getPageTool();
    const r = await tool.handler({ id: "NTP-NEVER" });
    expect(r.isError).toBe(true);
  });

  it("returns the injection-payload page intact (no server-side scrubbing — that is for runtime detection)", async () => {
    const { tool } = getPageTool();
    const r = await tool.handler({ id: INJECTION_PAYLOAD_PAGE_ID });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.body.toLowerCase()).toContain("ignore previous instructions");
  });
});

describe("notion tool scope metadata", () => {
  it("every tool declares notion:read scope", () => {
    for (const t of tools(createState())) {
      expect(t.requiredScopes).toContain("notion:read");
    }
  });
});
