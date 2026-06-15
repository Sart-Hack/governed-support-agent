import { expect, test } from "@playwright/test";

test("shield page shows the public API and the five controls", async ({ page }) => {
  await page.goto("/shield");
  await expect(page.getByRole("heading", { level: 1, name: "agent-shield" })).toBeVisible();

  // The wrap() call and install command are present and copy-pasteable.
  await expect(page.getByText("guard.wrap(step)")).toBeVisible();
  await expect(page.getByText("pnpm add @sarthak/agent-shield")).toBeVisible();

  // Each of the five ShieldConfig controls is named.
  for (const control of ["policies", "audit", "killSwitch", "scopeCheck", "breaker"]) {
    await expect(page.getByText(control, { exact: true }).first()).toBeVisible();
  }
});
