import { expect, test } from "@playwright/test";

test("persistent nav and audit strip render on every page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("complementary")).toBeVisible(); // <aside> nav
  await expect(page.getByText("recorded run")).toBeVisible(); // audit strip marker
});

test("nav links route to each governance page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Policies", exact: true }).click();
  await expect(page).toHaveURL(/\/policies$/);
  await expect(page.getByRole("heading", { level: 1, name: "Policies" })).toBeVisible();

  await page.getByRole("link", { name: "Permissions", exact: true }).click();
  await expect(page).toHaveURL(/\/permissions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Permissions" })).toBeVisible();
});

test("traces nav link reaches the dynamic trace route", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Traces", exact: true }).click();
  await expect(page).toHaveURL(/\/traces\/scenario-1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Traces" })).toBeVisible();
  await expect(page.getByText(/\/ \$0\.50 ceiling/)).toBeVisible();
});
