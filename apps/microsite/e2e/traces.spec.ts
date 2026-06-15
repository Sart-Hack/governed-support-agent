import { expect, test } from "@playwright/test";

test("trace viewer renders the span tree, cost overlay, and playback controls", async ({
  page,
}) => {
  await page.goto("/traces/scenario-1");
  await expect(page.getByRole("heading", { level: 1, name: "Traces" })).toBeVisible();

  // Span waterfall shows the real tool/LLM/policy spans of scenario 1.
  await expect(page.getByText("classify", { exact: true })).toBeVisible();
  await expect(page.getByText("getTicket", { exact: true })).toBeVisible();
  await expect(page.getByText("replyInternal", { exact: true })).toBeVisible();

  // Cost overlay names the $0.50 ceiling.
  await expect(page.getByText(/\/ \$0\.50 ceiling/)).toBeVisible();
  await expect(page.locator("svg[role=img]")).toBeVisible();

  // Playback starts fully revealed: step-forward is disabled, step-back is not.
  const stepForward = page.getByRole("button", { name: "Step forward" });
  const stepBack = page.getByRole("button", { name: "Step back" });
  await expect(stepForward).toBeDisabled();
  await stepBack.click();
  await expect(stepForward).toBeEnabled();
});

test("trace switcher reaches the breaker run, which crosses the ceiling and halts", async ({
  page,
}) => {
  await page.goto("/traces/scenario-1");
  await page.getByRole("link", { name: /TCK-2/ }).click();
  await expect(page).toHaveURL(/\/traces\/scenario-2/);

  await expect(page.getByText("circuit.tripped", { exact: true })).toBeVisible();
  await expect(page.getByText("halted", { exact: true })).toBeVisible();
});
