import { expect, test } from "@playwright/test";

test("home page renders the locked positioning sentence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "AI agents your security team will actually approve",
  );
});

test("home page renders the three proof cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Scoped access" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Full audit trail" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Human in the loop" })).toBeVisible();
});
