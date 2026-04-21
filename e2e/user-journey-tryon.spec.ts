import { test, expect } from "@playwright/test";

/**
 * Real user journey: Visitor → Mirror → Try On
 */
test.describe("User Journey: Try On Flow", () => {
  const prodUrl = process.env.BASE_URL || "https://wonderful-sky-0513a3610.7.azurestaticapps.net";

  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(["camera"]);
  });

  test("visitor can navigate to mirror and see try-on UI", async ({ page }) => {
    // 1. Land on home page
    await page.goto(prodUrl);
    await expect(page.locator("body")).toBeVisible();

    // 2. Navigate to mirror
    const mirrorLink = page.locator("text=/Try On|Mirror|try it/i").first();
    if (await mirrorLink.isVisible()) {
      await mirrorLink.click();
    } else {
      await page.goto(`${prodUrl}/mirror`);
    }

    // 3. Wait for page to load
    await page.waitForTimeout(3000);

    // 4. Verify we're on mirror page with try-on UI
    const content = await page.content();
    expect(content).toContain("VirtualFit");

    // 5. Should have either canvas (3D), video element (camera), or main content
    const hasCanvas = await page.locator("canvas").count();
    const hasVideo = await page.locator("video").count();
    const hasMain = await page.locator("main, [data-clean]").count();
    expect(hasCanvas + hasVideo + hasMain).toBeGreaterThan(0);
  });

  test("visitor can see garment options on mirror page", async ({ page }) => {
    await page.goto(`${prodUrl}/mirror`);
    await page.waitForTimeout(3000);

    // Look for any garment-related UI
    // Could be buttons, grid, sidebar with clothing items
    const content = await page.content();
    
    // Mirror page should have some garment selection UI
    // Even if camera is denied, the garment picker should be visible
    const hasGarmentUI = 
      content.includes("shirt") ||
      content.includes("Shirt") ||
      content.includes("garment") ||
      content.includes("Upload") ||
      content.includes("upload");
    
    expect(hasGarmentUI).toBe(true);
  });

  test("visitor can access upload functionality", async ({ page }) => {
    await page.goto(`${prodUrl}/mirror`);
    await page.waitForTimeout(3000);

    // Look for upload button or file input
    const uploadButton = page.locator("text=/upload/i");
    const fileInput = page.locator('input[type="file"]');
    
    const hasUpload = 
      (await uploadButton.count()) > 0 || 
      (await fileInput.count()) > 0;
    
    expect(hasUpload).toBe(true);
  });

  test("mirror page handles camera denial gracefully", async ({ page }) => {
    // Override permission to denied
    await page.context().clearPermissions();
    
    await page.goto(`${prodUrl}/mirror`);
    await page.waitForTimeout(3000);

    // Page should still be usable (show fallback or prompt)
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain("VirtualFit");
  });
});
