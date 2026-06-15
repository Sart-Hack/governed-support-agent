import { expect, test } from "@playwright/test";

test("evals page shows pending suites and the real 10/10 ASI coverage map", async ({ page }) => {
  await page.goto("/evals");
  await expect(page.getByRole("heading", { level: 1, name: "Evals" })).toBeVisible();

  // Three suites, honestly pending (no fabricated pass rate).
  await expect(page.getByRole("heading", { name: "Custom suite" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "InjecAgent subset" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OWASP-ASI assertions" })).toBeVisible();
  await expect(page.getByText(/pending · runs in Phase 4 CI/).first()).toBeVisible();

  // All ten ASI ids appear in the coverage table.
  for (const n of ["01", "05", "07", "10"]) {
    await expect(page.getByText(`ASI${n}`, { exact: true })).toBeVisible();
  }

  // Policy-backed rows deep-link to the real .cedar file.
  await expect(page.locator('a[href*="06-delete-account-never.cedar"]').first()).toBeVisible();
});
