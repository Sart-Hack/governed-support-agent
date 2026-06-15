import { expect, test } from "@playwright/test";

test("permissions matrix renders roles, actions, and deciding policies", async ({ page }) => {
  await page.goto("/permissions");
  await expect(page.getByRole("heading", { level: 1, name: "Permissions" })).toBeVisible();

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  // Role columns (scoped to the table; the header cells are the only role text there).
  await expect(table.getByText("SupportLead")).toBeVisible();
  await expect(table.getByText("Engineer")).toBeVisible();

  // A sample of actions across servers.
  await expect(page.getByRole("cell", { name: "replyPublic", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "deleteUser", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "createIssue", exact: true })).toBeVisible();

  // A deny cell cites the deciding policy in its hover title.
  await expect(page.locator('[title*="policy 06"]').first()).toBeVisible();
});
