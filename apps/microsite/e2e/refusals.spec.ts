import { expect, test } from "@playwright/test";

test("refusals page replays four real Cedar denials with reason chains", async ({ page }) => {
  await page.goto("/refusals");
  await expect(page.getByRole("heading", { level: 1, name: "Refusals" })).toBeVisible();

  // Four scene pills, one per OWASP-ASI threat.
  for (const t of ["TCK-5", "TCK-6", "TCK-4", "TCK-8"]) {
    await expect(page.getByRole("button", { name: new RegExp(t) })).toBeVisible();
  }

  // The default (delete) scene shows the real forbid verdict and defense in depth.
  await expect(page.getByText("DENY", { exact: true })).toBeVisible();
  await expect(page.getByText(/forbidden by policy 06-delete-account-never/)).toBeVisible();
  await expect(page.getByText(/hard-forbids the deletion server-side/)).toBeVisible();
});

test("the verdict is gated on playback and updates per scene", async ({ page }) => {
  await page.goto("/refusals");

  // Scrub back to the start: the verdict panel is not revealed yet.
  await page.getByLabel("Scrub the refusal scene").fill("0");
  await expect(page.getByText("evaluating policy…")).toBeVisible();
  await expect(page.getByText("DENY", { exact: true })).toHaveCount(0);

  // Switch to the cross-tenant scene: a different real policy decides.
  await page.getByRole("button", { name: /TCK-8/ }).click();
  await expect(page.getByText(/forbidden by policy 07-tenant-isolation/)).toBeVisible();
});
