import { expect, test } from "@playwright/test";

test("finds slots and exposes conflict details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Find best time/i }).click();
  await expect(page.getByText("Conflict Resolution Table")).toBeVisible();
  await page.getByRole("button", { name: /Details/i }).first().click();
  await expect(page.getByText(/Conflict details|No conflicts/i)).toBeVisible();
});
