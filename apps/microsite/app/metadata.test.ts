import { describe, expect, it } from "vitest";
import { siteMetadata } from "./metadata";

describe("microsite metadata", () => {
  it("uses the locked positioning sentence in description", () => {
    expect(siteMetadata.description).toContain(
      "AI agents your security team will actually approve",
    );
    expect(siteMetadata.description).toContain("US tech companies past Series A");
    expect(siteMetadata.description).toContain("agents, not chatbots");
  });

  it("has a title", () => {
    expect(siteMetadata.title).toBe("Governed Support Ops Agent");
  });
});
