import { expect, test } from "@playwright/test";

test("finds slots and exposes conflict details", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Describe your meeting").fill("30-minute project review with Alice and Bob next week in the afternoon");
  await page.getByRole("button", { name: /Find best time/i }).click();
  await page.getByRole("button", { name: /Confirm & find slots/i }).click();
  await expect(page.getByText("Conflict Resolution Table")).toBeVisible();
  await page.getByRole("button", { name: /Details/i }).first().click();
  await expect(page.getByRole("dialog", { name: /Conflict details for/i })).toBeVisible();
});
