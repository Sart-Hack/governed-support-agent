import { expect, test } from "@playwright/test";

test("home page renders the locked positioning sentence and the differentiator", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "AI agents your security team will actually approve",
  );
  await expect(
    page.getByText("This governs what the agent is allowed to do, not what it says."),
  ).toBeVisible();
});

test("home page renders the four proof cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Delete the account" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Indirect prompt injection" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Unredacted PII read" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Runaway loop, halted" })).toBeVisible();
});

test("injection card leads with the runtime quarantine detector, not a Cedar deny", async ({
  page,
}) => {
  await page.goto("/");
  // Primary mechanism is the runtime detector against the real payload page.
  await expect(page.getByText("agent-shield injection detector")).toBeVisible();
  await expect(page.getByText("getPage(NTP-KB-5)")).toBeVisible();
  // Cedar policy 02 appears as the complementary access-layer control, not first.
  await expect(page.getByText("Cedar policy 02 separately blocks")).toBeVisible();
});
