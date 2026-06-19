import { expect, test } from "@playwright/test";

test("trust page lists policy-enforced boundaries, model facts, and an honest eval note", async ({
  page,
}) => {
  await page.goto("/trust");
  await expect(page.getByRole("heading", { level: 1, name: "Trust" })).toBeVisible();

  // Every will-never-automate boundary names the policy that enforces it.
  await expect(page.getByText("Will never automate", { exact: true })).toBeVisible();
  await expect(page.getByText(/06-delete-account-never · ASI10/)).toBeVisible();
  await expect(page.getByText(/07-tenant-isolation · ASI06/)).toBeVisible();

  // Model + cost disclosure, including the breaker ceiling.
  await expect(page.getByText("openai/gpt-4o-mini (via Bifrost)")).toBeVisible();
  await expect(page.getByText("$0.50 (circuit breaker)")).toBeVisible();

  // Evals render the real committed suite results (data-driven from latest.json),
  // each labelled with its target, and link out to the per-ID coverage.
  await expect(page.getByText("Custom suite")).toBeVisible();
  await expect(page.getByText("OWASP-ASI assertions")).toBeVisible();
  await expect(page.getByRole("link", { name: "evals page" })).toBeVisible();
});
