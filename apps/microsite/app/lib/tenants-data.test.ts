import { describe, expect, it } from "vitest";
import { getTenantProof } from "./tenants";
import data from "./tenants-data.json";

describe("tenants-data.json", () => {
  it("matches a fresh Cedar evaluation (regenerate with pnpm gen:tenants)", () => {
    expect(data).toEqual(getTenantProof());
  });
});
