import { expect, test } from "@playwright/test";

test("policies page shows the real Cedar source and switches tabs", async ({ page }) => {
  await page.goto("/policies");
  await expect(page.getByRole("heading", { level: 1, name: "Policies" })).toBeVisible();

  // Default tab is policy 01 (permit, Zendesk read-only).
  await expect(page.getByText("01-zendesk-read-only.cedar")).toBeVisible();
  await expect(page.locator("code")).toContainText("SupportLead");

  // Switch to the hard-forbid delete policy; the filename bar and source update.
  // Assertions scope to the unique filename or the single <code> element, since
  // the rendered source echoes the @asi/@description annotation text.
  await page.getByRole("button", { name: /Delete account never/ }).click();
  await expect(page.getByText("06-delete-account-never.cedar")).toBeVisible();
  await expect(page.locator("code")).toContainText("deleteAccount");
  await expect(page.locator("code")).toContainText("forbid");
  await expect(page.locator("code")).not.toContainText("SupportLead");
});
