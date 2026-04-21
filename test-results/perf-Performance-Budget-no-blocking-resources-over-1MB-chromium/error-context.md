# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Performance Budget >> no blocking resources over 1MB
- Location: e2e/perf.spec.ts:76:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/mirror", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e6]:
        - heading "👗 Welcome to VirtualFit!" [level=1] [ref=e7]
        - paragraph [ref=e8]: Try on clothes virtually using your camera and AI-powered body tracking.
        - generic [ref=e9]:
          - paragraph [ref=e10]:
            - strong [ref=e11]: "Quick Start:"
          - paragraph [ref=e12]: 1️⃣ Click "Start Camera" and allow camera access
          - paragraph [ref=e13]: 2️⃣ Stand back so your shoulders and torso are visible
          - paragraph [ref=e14]: 3️⃣ Select a garment from the gallery or upload your own
          - paragraph [ref=e15]: 4️⃣ Adjust the fit using controls below the video
          - paragraph [ref=e16]:
            - strong [ref=e17]: "📱 Touch Gestures:"
          - paragraph [ref=e18]: 👈👉 Swipe left/right to change garments
          - paragraph [ref=e19]: 👆👆 Double-tap to cycle to next garment
          - paragraph [ref=e20]: 🤏 Pinch with 2 fingers to resize
          - paragraph [ref=e21]: ✋ Two-finger drag to reposition
        - button "Let's Try It! →" [ref=e22] [cursor=pointer]
        - paragraph [ref=e23]: Tap anywhere to dismiss
      - heading "🪞 Virtual Try-On" [level=1] [ref=e24]
      - paragraph [ref=e25]: Upload any clothing photo → see it on you in 3D
      - generic [ref=e29]:
        - generic [ref=e30]: 👗
        - heading "Virtual Try-On" [level=2] [ref=e31]
        - paragraph [ref=e32]: See how clothes look on you in real-time using your camera
        - button "✨ Try It On" [ref=e33] [cursor=pointer]
        - paragraph [ref=e34]: No photos are stored • Works offline
      - paragraph [ref=e35]: Tap below to start trying on clothes
      - generic [ref=e36]:
        - paragraph [ref=e37]:
          - strong [ref=e38]: "How it works:"
        - paragraph [ref=e39]: 1. Start camera → MediaPipe tracks your body
        - paragraph [ref=e40]: 2. Upload any clothing photo → AI removes background
        - paragraph [ref=e41]: 3. Image becomes a 3D curved mesh anchored to your shoulders
      - generic [ref=e42]:
        - paragraph [ref=e43]: VirtualFit v2.5.0 • 200 features • Built with Next.js + Three.js + MediaPipe
        - paragraph [ref=e44]:
          - link "❓ Help" [ref=e45] [cursor=pointer]:
            - /url: "#"
          - text: •
          - link "📖 Tutorial" [ref=e46] [cursor=pointer]:
            - /url: "#"
          - text: •
          - link "🗑️ Clear Data" [ref=e47] [cursor=pointer]:
            - /url: "#"
  - generic:
    - generic [ref=e50] [cursor=pointer]:
      - img [ref=e51]
      - generic [ref=e53]: 1 error
      - button "Hide Errors" [ref=e54]:
        - img [ref=e55]
    - status [ref=e58]:
      - generic [ref=e59]:
        - img [ref=e61]
        - generic [ref=e63]:
          - text: Static route
          - button "Hide static indicator" [ref=e64] [cursor=pointer]:
            - img [ref=e65]
  - alert [ref=e68]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Performance budget tests
  5   |  * Ensures pages load within acceptable time limits
  6   |  */
  7   | test.describe("Performance Budget", () => {
  8   |   test.beforeEach(async ({ page }) => {
  9   |     await page.context().grantPermissions(["camera"]);
  10  |   });
  11  | 
  12  |   test("mirror page loads within performance budget", async ({ page }) => {
  13  |     // Navigate and wait for load
  14  |     const startTime = Date.now();
  15  |     await page.goto("/mirror", { waitUntil: "domcontentloaded" });
  16  |     const domContentLoaded = Date.now() - startTime;
  17  | 
  18  |     // Wait for full load
  19  |     await page.waitForLoadState("load");
  20  |     const fullLoad = Date.now() - startTime;
  21  | 
  22  |     // Performance budgets (generous for CI variability)
  23  |     // DOMContentLoaded should be under 5s
  24  |     expect(domContentLoaded).toBeLessThan(5000);
  25  |     
  26  |     // Full load should be under 10s (includes 3D libs, camera init)
  27  |     expect(fullLoad).toBeLessThan(10000);
  28  |   });
  29  | 
  30  |   test("home page loads quickly", async ({ page }) => {
  31  |     const startTime = Date.now();
  32  |     await page.goto("/", { waitUntil: "domcontentloaded" });
  33  |     const domContentLoaded = Date.now() - startTime;
  34  | 
  35  |     // Home page should be fast - under 3s
  36  |     expect(domContentLoaded).toBeLessThan(3000);
  37  |   });
  38  | 
  39  |   test("pricing page loads quickly", async ({ page }) => {
  40  |     const startTime = Date.now();
  41  |     await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  42  |     const domContentLoaded = Date.now() - startTime;
  43  | 
  44  |     // Static page should load fast
  45  |     expect(domContentLoaded).toBeLessThan(3000);
  46  |   });
  47  | 
  48  |   test("generate-3d page loads within budget", async ({ page }) => {
  49  |     const startTime = Date.now();
  50  |     await page.goto("/generate-3d", { waitUntil: "domcontentloaded" });
  51  |     const domContentLoaded = Date.now() - startTime;
  52  | 
  53  |     expect(domContentLoaded).toBeLessThan(4000);
  54  |   });
  55  | 
  56  |   test("mirror page JavaScript bundle size check", async ({ page }) => {
  57  |     const jsRequests: number[] = [];
  58  | 
  59  |     page.on("response", (response) => {
  60  |       const url = response.url();
  61  |       if (url.endsWith(".js") || url.includes("/_next/static")) {
  62  |         const contentLength = response.headers()["content-length"];
  63  |         if (contentLength) {
  64  |           jsRequests.push(parseInt(contentLength));
  65  |         }
  66  |       }
  67  |     });
  68  | 
  69  |     await page.goto("/mirror", { waitUntil: "networkidle" });
  70  | 
  71  |     // Total JS should be under 5MB (generous for Three.js + MediaPipe)
  72  |     const totalJS = jsRequests.reduce((sum, size) => sum + size, 0);
  73  |     expect(totalJS).toBeLessThan(5 * 1024 * 1024);
  74  |   });
  75  | 
  76  |   test("no blocking resources over 1MB", async ({ page }) => {
  77  |     const largeResources: { url: string; size: number }[] = [];
  78  | 
  79  |     page.on("response", async (response) => {
  80  |       const contentLength = response.headers()["content-length"];
  81  |       if (contentLength && parseInt(contentLength) > 1024 * 1024) {
  82  |         largeResources.push({
  83  |           url: response.url(),
  84  |           size: parseInt(contentLength),
  85  |         });
  86  |       }
  87  |     });
  88  | 
> 89  |     await page.goto("/mirror", { waitUntil: "networkidle" });
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  90  | 
  91  |     // Log large resources for debugging (not failing, just informational)
  92  |     if (largeResources.length > 0) {
  93  |       console.log(
  94  |         "Large resources:",
  95  |         largeResources.map((r) => `${r.url}: ${(r.size / 1024 / 1024).toFixed(2)}MB`)
  96  |       );
  97  |     }
  98  | 
  99  |     // Allow some large resources (e.g., MediaPipe models) but cap at 10
  100 |     expect(largeResources.length).toBeLessThan(10);
  101 |   });
  102 | 
  103 |   test("time to interactive is reasonable", async ({ page }) => {
  104 |     await page.goto("/mirror", { waitUntil: "domcontentloaded" });
  105 | 
  106 |     // Wait for interactive elements to be ready
  107 |     const startTime = Date.now();
  108 |     
  109 |     // Try to find and interact with a button (proves page is interactive)
  110 |     const button = page.locator("button").first();
  111 |     await button.waitFor({ state: "visible", timeout: 5000 });
  112 |     
  113 |     const timeToInteractive = Date.now() - startTime;
  114 |     
  115 |     // Should be interactive within 5s of DOMContentLoaded
  116 |     expect(timeToInteractive).toBeLessThan(5000);
  117 |   });
  118 | });
  119 | 
```