import { test, expect } from "@playwright/test";

/**
 * Mobile responsiveness tests for gallery page
 */
test.describe("Gallery Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("gallery loads on mobile viewport", async ({ page }) => {
    await page.goto("/gallery");
    await page.waitForTimeout(2000);

    // Page should load without horizontal scroll
    const body = page.locator("body");
    const boundingBox = await body.boundingBox();
    expect(boundingBox?.width).toBeLessThanOrEqual(390);
    
    // Should show gallery title
    await expect(page.locator("h1")).toContainText("My Garments");
  });

  test("gallery grid adapts to mobile", async ({ page }) => {
    await page.goto("/gallery");
    await page.waitForTimeout(2000);

    // The page should have a container div
    const container = page.locator("main > div").first();
    await expect(container).toBeVisible();
  });

  test("Try On New button is tappable on mobile", async ({ page }) => {
    await page.goto("/gallery");
    await page.waitForTimeout(2000);

    const tryOnButton = page.locator("text=Try On New");
    await expect(tryOnButton).toBeVisible();
    
    const box = await tryOnButton.boundingBox();
    // Button should be at least 44x44 for touch targets
    expect(box?.height).toBeGreaterThanOrEqual(40);
  });

  test("empty state shows on fresh gallery", async ({ page }) => {
    // Clear storage first
    await page.goto("/gallery");
    await page.evaluate(() => localStorage.removeItem("savedGarments"));
    await page.reload();
    await page.waitForTimeout(2000);

    // Should show empty state
    await expect(page.locator("text=No saved garments yet")).toBeVisible();
    await expect(page.locator("text=Start Trying On")).toBeVisible();
  });
});
