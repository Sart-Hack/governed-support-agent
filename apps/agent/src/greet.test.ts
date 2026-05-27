import { describe, expect, it } from "vitest";
import { greet } from "./greet.js";

describe("greet", () => {
  it("returns the agent ready string", () => {
    expect(greet()).toBe("Governed Support Ops Agent ready.");
  });
});
