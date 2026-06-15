import { expect, test } from "@playwright/test";

test("run page gives copy-pasteable clone, stack, and demo commands", async ({ page }) => {
  await page.goto("/run");
  await expect(page.getByRole("heading", { level: 1, name: "Clone and run" })).toBeVisible();

  await expect(page.getByText(/git clone https:\/\/github.com\/Sart-Hack/)).toBeVisible();
  await expect(page.getByText("pnpm stack:up")).toBeVisible();
  await expect(page.getByText(/pnpm demo TCK-5/)).toBeVisible();

  // Repo link is present.
  await expect(
    page.locator('a[href="https://github.com/Sart-Hack/governed-support-agent"]').first(),
  ).toBeVisible();
});
