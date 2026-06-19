import { expect, test } from "@playwright/test";

test("evals page shows the three suites with real pass rates and the 10/10 ASI coverage map", async ({
  page,
}) => {
  await page.goto("/evals");
  await expect(page.getByRole("heading", { level: 1, name: "Evals" })).toBeVisible();

  // Three suites, each rendering a real pass rate from the committed results.
  await expect(page.getByRole("heading", { name: "Custom suite" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "InjecAgent subset" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OWASP-ASI assertions" })).toBeVisible();
  await expect(page.getByText(/\d+\/\d+ pass/).first()).toBeVisible();

  // All ten ASI ids appear in the coverage table.
  for (const n of ["01", "05", "07", "10"]) {
    await expect(page.getByText(`ASI${n}`, { exact: true })).toBeVisible();
  }

  // Policy-backed rows deep-link to the real .cedar file.
  await expect(page.locator('a[href*="06-delete-account-never.cedar"]').first()).toBeVisible();
});
