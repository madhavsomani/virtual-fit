import { test, expect } from "@playwright/test";

/**
 * Performance budget tests
 * Ensures pages load within acceptable time limits
 */
test.describe("Performance Budget", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(["camera"]);
  });

  test("mirror page loads within performance budget", async ({ page }) => {
    // Navigate and wait for load
    const startTime = Date.now();
    await page.goto("/mirror", { waitUntil: "domcontentloaded" });
    const domContentLoaded = Date.now() - startTime;

    // Wait for full load
    await page.waitForLoadState("load");
    const fullLoad = Date.now() - startTime;

    // Performance budgets (generous for CI variability)
    // DOMContentLoaded should be under 5s
    expect(domContentLoaded).toBeLessThan(5000);
    
    // Full load should be under 10s (includes 3D libs, camera init)
    expect(fullLoad).toBeLessThan(10000);
  });

  test("home page loads quickly", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const domContentLoaded = Date.now() - startTime;

    // Home page should be fast - under 3s
    expect(domContentLoaded).toBeLessThan(3000);
  });

  test("pricing page loads quickly", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    const domContentLoaded = Date.now() - startTime;

    // Static page should load fast
    expect(domContentLoaded).toBeLessThan(3000);
  });

  test("generate-3d page loads within budget", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/generate-3d", { waitUntil: "domcontentloaded" });
    const domContentLoaded = Date.now() - startTime;

    expect(domContentLoaded).toBeLessThan(4000);
  });

  test("mirror page JavaScript bundle size check", async ({ page }) => {
    const jsRequests: number[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".js") || url.includes("/_next/static")) {
        const contentLength = response.headers()["content-length"];
        if (contentLength) {
          jsRequests.push(parseInt(contentLength));
        }
      }
    });

    await page.goto("/mirror", { waitUntil: "load" });

    // Total JS should be under 5MB (generous for Three.js + MediaPipe)
    const totalJS = jsRequests.reduce((sum, size) => sum + size, 0);
    expect(totalJS).toBeLessThan(5 * 1024 * 1024);
  });

  test("no blocking resources over 1MB", async ({ page }) => {
    const largeResources: { url: string; size: number }[] = [];

    page.on("response", async (response) => {
      const contentLength = response.headers()["content-length"];
      if (contentLength && parseInt(contentLength) > 1024 * 1024) {
        largeResources.push({
          url: response.url(),
          size: parseInt(contentLength),
        });
      }
    });

    await page.goto("/mirror", { waitUntil: "load" });

    // Log large resources for debugging (not failing, just informational)
    if (largeResources.length > 0) {
      console.log(
        "Large resources:",
        largeResources.map((r) => `${r.url}: ${(r.size / 1024 / 1024).toFixed(2)}MB`)
      );
    }

    // Allow some large resources (e.g., MediaPipe models) but cap at 10
    expect(largeResources.length).toBeLessThan(10);
  });

  test("time to interactive is reasonable", async ({ page }) => {
    await page.goto("/mirror", { waitUntil: "domcontentloaded" });

    // Wait for interactive elements to be ready
    const startTime = Date.now();
    
    // Try to find and interact with a button (proves page is interactive)
    const button = page.locator("button").first();
    await button.waitFor({ state: "visible", timeout: 5000 });
    
    const timeToInteractive = Date.now() - startTime;
    
    // Should be interactive within 5s of DOMContentLoaded
    expect(timeToInteractive).toBeLessThan(5000);
  });
});
