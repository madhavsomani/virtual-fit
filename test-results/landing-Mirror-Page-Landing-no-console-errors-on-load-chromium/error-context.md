# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> Mirror Page Landing >> no console errors on load
- Location: e2e/landing.spec.ts:9:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  ["Failed to load resource: the server responded with a status of 404 (Not Found)"]
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
  3   | test.describe("Mirror Page Landing", () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     // Grant camera permission
  6   |     await page.context().grantPermissions(["camera"]);
  7   |   });
  8   | 
  9   |   test("no console errors on load", async ({ page }) => {
  10  |     const errors: string[] = [];
  11  |     page.on("console", (msg) => {
  12  |       if (msg.type() === "error") {
  13  |         errors.push(msg.text());
  14  |       }
  15  |     });
  16  | 
  17  |     await page.goto("/mirror");
  18  |     await page.waitForTimeout(3000);
  19  | 
  20  |     // Filter out expected errors (e.g., camera not available in headless)
  21  |     const unexpectedErrors = errors.filter(
  22  |       (e) => !e.includes("getUserMedia") && !e.includes("NotFoundError")
  23  |     );
  24  |     
> 25  |     expect(unexpectedErrors).toHaveLength(0);
      |                              ^ Error: expect(received).toHaveLength(expected)
  26  |   });
  27  | 
  28  |   test("no critical JS exceptions", async ({ page }) => {
  29  |     const exceptions: string[] = [];
  30  |     page.on("pageerror", (err) => {
  31  |       exceptions.push(err.message);
  32  |     });
  33  | 
  34  |     await page.goto("/mirror");
  35  |     await page.waitForTimeout(3000);
  36  | 
  37  |     // Filter out expected exceptions (camera, WebGL, hydration in headless)
  38  |     const criticalExceptions = exceptions.filter(
  39  |       (e) =>
  40  |         !e.includes("getUserMedia") &&
  41  |         !e.includes("NotFoundError") &&
  42  |         !e.includes("camera") &&
  43  |         !e.includes("WebGL") &&
  44  |         !e.includes("THREE") &&
  45  |         !e.includes("Hydration") &&
  46  |         !e.includes("hydration")
  47  |     );
  48  |     
  49  |     expect(criticalExceptions).toHaveLength(0);
  50  |   });
  51  | 
  52  |   test("all key elements visible", async ({ page }) => {
  53  |     await page.goto("/mirror");
  54  |     await page.waitForTimeout(2000);
  55  | 
  56  |     // Check for VirtualFit branding
  57  |     const content = await page.content();
  58  |     expect(content).toContain("VirtualFit");
  59  | 
  60  |     // Check for canvas (Three.js) or video element
  61  |     const hasCanvas = await page.locator("canvas").count();
  62  |     const hasVideo = await page.locator("video").count();
  63  |     expect(hasCanvas + hasVideo).toBeGreaterThan(0);
  64  |   });
  65  | 
  66  |   test("upload button exists", async ({ page }) => {
  67  |     await page.goto("/mirror");
  68  |     await page.waitForTimeout(2000);
  69  | 
  70  |     // Look for upload-related UI
  71  |     const uploadBtn = page.locator("text=/upload|Upload/i");
  72  |     const inputFile = page.locator('input[type="file"]');
  73  |     
  74  |     const hasUploadUI = (await uploadBtn.count()) > 0 || (await inputFile.count()) > 0;
  75  |     expect(hasUploadUI).toBe(true);
  76  |   });
  77  | });
  78  | 
  79  | test.describe("Mobile Viewport", () => {
  80  |   test.use({ viewport: { width: 390, height: 844 } });
  81  | 
  82  |   test.beforeEach(async ({ page }) => {
  83  |     await page.context().grantPermissions(["camera"]);
  84  |   });
  85  | 
  86  |   test("mirror loads on mobile viewport (390x844)", async ({ page }) => {
  87  |     await page.goto("/mirror");
  88  |     await page.waitForTimeout(2000);
  89  | 
  90  |     // Page should load without crashing
  91  |     const content = await page.content();
  92  |     expect(content.length).toBeGreaterThan(100);
  93  |     expect(content).toContain("VirtualFit");
  94  |   });
  95  | 
  96  |   test("controls are reachable on mobile", async ({ page }) => {
  97  |     await page.goto("/mirror");
  98  |     await page.waitForTimeout(2000);
  99  | 
  100 |     // Check that some interactive elements are visible in viewport
  101 |     const body = page.locator("body");
  102 |     await expect(body).toBeVisible();
  103 |     
  104 |     // Any button should be clickable (not hidden off-screen)
  105 |     const buttons = await page.locator("button").all();
  106 |     if (buttons.length > 0) {
  107 |       const firstButton = buttons[0];
  108 |       await expect(firstButton).toBeVisible();
  109 |     }
  110 |   });
  111 | });
  112 | 
  113 | test.describe("Generate 3D Page", () => {
  114 |   test("page loads with upload area", async ({ page }) => {
  115 |     await page.goto("/generate-3d");
  116 |     await page.waitForTimeout(2000);
  117 | 
  118 |     // Check for upload-related content
  119 |     const content = await page.content();
  120 |     expect(content).toContain("Generate");
  121 |     
  122 |     // Look for file input or upload zone
  123 |     const fileInput = page.locator('input[type="file"]');
  124 |     const uploadText = page.locator("text=/upload|drag|drop/i");
  125 |     
```