import { describe, expect, it } from "vitest";
import { getPermissionMatrix } from "./permissions";
import data from "./permissions-data.json";

describe("permissions-data.json", () => {
  it("matches a fresh Cedar evaluation (regenerate with pnpm gen:permissions)", () => {
    expect(data).toEqual(getPermissionMatrix());
  });
});
