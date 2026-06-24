import { expect, test } from "@playwright/test";

test("shield page shows the public API and the five controls", async ({ page }) => {
  await page.goto("/shield");
  await expect(page.getByRole("heading", { level: 1, name: "agent-shield" })).toBeVisible();

  // The wrap() call shows the public API; the page frames the layer as a
  // reference extracted from the demo, not a product to install.
  await expect(page.getByText("guard.wrap(step)")).toBeVisible();
  await expect(page.getByText("reference integration")).toBeVisible();

  // Each of the five ShieldConfig controls is named.
  for (const control of ["policies", "audit", "killSwitch", "scopeCheck", "breaker"]) {
    await expect(page.getByText(control, { exact: true }).first()).toBeVisible();
  }
});
