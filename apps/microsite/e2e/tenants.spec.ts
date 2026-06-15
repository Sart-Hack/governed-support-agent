import { expect, test } from "@playwright/test";

test("tenants page proves policy 07 with a real allow and a real deny", async ({ page }) => {
  await page.goto("/tenants");
  await expect(page.getByRole("heading", { level: 1, name: "Tenants" })).toBeVisible();

  // Same-tenant request is permitted; cross-tenant request is denied.
  await expect(page.getByText("PERMIT", { exact: true })).toBeVisible();
  await expect(page.getByText("DENY", { exact: true })).toBeVisible();

  // The deny is attributed to policy 07 with its ASI mapping, via formatDecision().
  await expect(page.getByText(/forbidden by policy 07-tenant-isolation/)).toBeVisible();
  await expect(page.getByText("ASI06 Inter-Agent / Cross-Boundary").first()).toBeVisible();

  // The two requests differ only by the resource tenant.
  await expect(page.getByText("tenant = tenant-B")).toBeVisible();
});
