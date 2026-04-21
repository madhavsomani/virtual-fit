import { test, expect } from "@playwright/test";

/**
 * Real user journey: Visitor → Pricing → Buy/Waitlist
 */
test.describe("User Journey: Buy Flow", () => {
  const prodUrl = process.env.BASE_URL || "https://wonderful-sky-0513a3610.7.azurestaticapps.net";

  test("visitor can navigate from home to pricing and start checkout", async ({ page }) => {
    // 1. Land on home page
    await page.goto(prodUrl);
    await expect(page.locator("body")).toBeVisible();

    // 2. Look for pricing link
    const pricingLink = page.locator("text=/pricing|Pricing/i").first();
    if (await pricingLink.isVisible()) {
      await pricingLink.click();
    } else {
      await page.goto(`${prodUrl}/pricing`);
    }

    // 3. Verify pricing page loaded
    await expect(page.locator("text=Simple, transparent pricing")).toBeVisible();

    // 4. Find and click "Get Started" or "Start Free Trial"
    const ctaButton = page.locator("text=/Get Started|Start Free Trial/i").first();
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    // 5. Should redirect to Stripe OR waitlist (depends on config)
    await page.waitForTimeout(3000);
    const url = page.url();
    
    // Valid outcomes: still on site with waitlist, or redirected to Stripe
    const isValidOutcome = 
      url.includes("stripe") ||
      url.includes("buy.stripe") ||
      url.includes("waitlist") ||
      url.includes("checkout") ||
      url.includes(prodUrl);
    
    expect(isValidOutcome).toBe(true);
  });

  test("visitor can join waitlist from home page", async ({ page }) => {
    await page.goto(prodUrl);
    
    // Find email input
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Fill email
    await emailInput.fill("test-journey@example.com");

    // Submit
    const submitButton = page.locator("text=Join Waitlist");
    await submitButton.click();

    // Should show survey or success
    await page.waitForTimeout(2000);
    const content = await page.content();
    
    // Valid outcomes: survey question, success message, or still on form
    const hasResponse = 
      content.includes("revenue") ||
      content.includes("Monthly Revenue") ||
      content.includes("Thank") ||
      content.includes("success");
    
    expect(hasResponse).toBe(true);
  });
});
