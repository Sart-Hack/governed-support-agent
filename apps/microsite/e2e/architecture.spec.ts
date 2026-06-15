import { expect, test } from "@playwright/test";

test("architecture page renders the diagram with repo deep links and a legend", async ({
  page,
}) => {
  await page.goto("/architecture");
  await expect(page.getByRole("heading", { level: 1, name: "Architecture" })).toBeVisible();
  await expect(page.locator("svg[role=img]")).toBeVisible();

  // Subsystem boxes deep-link into the repo.
  await expect(page.locator('a[href*="packages/mcp-server-github"]').first()).toBeVisible();
  await expect(page.locator('a[href*="packages/agent-shield"]').first()).toBeVisible();

  // Legend explains the node palette.
  await expect(page.getByText("tool · MCP server")).toBeVisible();
});
