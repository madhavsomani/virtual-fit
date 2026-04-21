import { test, expect } from "@playwright/test";

test.describe("Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(["camera"]);
  });

  test("mirror page desktop baseline (1440x900)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/mirror");
    await page.waitForTimeout(3000);

    // Visual comparison with 5% tolerance for dynamic content
    await expect(page).toHaveScreenshot("mirror-desktop.png", {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    });
  });

  test("mirror page mobile baseline (390x844)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mirror");
    await page.waitForTimeout(3000);

    await expect(page).toHaveScreenshot("mirror-mobile.png", {
      maxDiffPixelRatio: 0.05,
      timeout: 10000,
    });
  });
});
