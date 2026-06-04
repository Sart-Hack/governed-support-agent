import { NoopKillSwitch } from "@sarthak/agent-shield";
import { describe, expect, it } from "vitest";
import { createKillSwitch } from "./kill-switch.js";

describe("createKillSwitch", () => {
  it("falls back to a no-op switch when MASTRA_DATABASE_URL is absent", async () => {
    const ks = createKillSwitch({} as NodeJS.ProcessEnv);
    expect(ks).toBeInstanceOf(NoopKillSwitch);
    expect(await ks.isTripped()).toBe(false);
  });
});
