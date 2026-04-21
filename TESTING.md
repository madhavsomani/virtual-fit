# Testing Guide

## Overview

VirtualFit has two test suites:
- **E2E tests** — Playwright, browser-based, 47 tests
- **Unit tests** — Node.js test runner, 111+ tests

## Running Tests

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/mirror.spec.ts

# Run with UI (headed mode)
npm run test:e2e:ui

# Update visual baselines
npm run test:e2e -- --update-snapshots
```

### Unit Tests (Node.js)

```bash
# Run all unit tests
node --test tests/*.test.mjs

# Run specific test
node --test tests/upload-3d-flow.test.mjs
```

## Test Structure

```
e2e/                          # Playwright E2E tests
├── mirror.spec.ts            # Core mirror page tests
├── landing.spec.ts           # Landing/home page tests
├── visual.spec.ts            # Visual regression tests
├── a11y.spec.ts              # Accessibility tests
├── perf.spec.ts              # Performance budget tests
├── user-journey-buy.spec.ts  # User journey: purchase flow
└── user-journey-tryon.spec.ts # User journey: try-on flow

tests/                        # Node.js unit tests
├── fixtures/                 # Test fixtures (GLB, PNG)
│   ├── sample-shirt.glb
│   └── sample-input.png
├── upload-3d-flow.test.mjs   # 3D upload logic tests
├── upload-3d-error-recovery.test.mjs # Error handling tests
├── body-metrics.test.mjs     # Pose tracking math
├── smoothing-utils.test.mjs  # Animation smoothing
└── ...                       # Many more unit tests
```

## Visual Regression Tests

Visual baselines are platform-specific (macOS vs Linux). On CI (Linux), visual tests are skipped.

To update baselines locally (macOS):
```bash
npm run test:e2e -- e2e/visual.spec.ts --update-snapshots
git add e2e/visual.spec.ts-snapshots/
git commit -m "test: update visual baselines"
```

## Test Configuration

### playwright.config.ts
- Uses `chromium` project only
- Runs against `http://localhost:3000` (dev server) or `npx serve out` (CI)
- Visual regression threshold: 5% pixel diff ratio

### Environment Variables
- `CI=true` — Skips visual tests, uses single worker
- `BASE_URL` — Override base URL for production testing

## CI Integration

Tests run automatically on push via GitHub Actions:
- `.github/workflows/e2e.yml` — E2E tests
- `.github/workflows/deploy.yml` — Deploy + smoke tests

## Adding New Tests

### E2E Test
```typescript
// e2e/my-feature.spec.ts
import { test, expect } from "@playwright/test";

test("my feature works", async ({ page }) => {
  await page.goto("/my-page");
  await expect(page.locator("h1")).toContainText("Expected");
});
```

### Unit Test
```javascript
// tests/my-logic.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('myFunction', () => {
  it('does the thing', () => {
    assert.strictEqual(myFunction(1), 2);
  });
});
```

## Debugging Failed Tests

```bash
# Run with trace on failure
npm run test:e2e -- --trace on

# View trace
npx playwright show-trace test-results/.../trace.zip

# Run in headed mode
npm run test:e2e -- --headed
```

## Performance Budgets

| Page | DOMContentLoaded | Full Load | JS Bundle |
|------|------------------|-----------|-----------|
| / | < 3s | - | - |
| /mirror | < 5s | < 10s | < 5MB |
| /pricing | < 3s | - | - |
| /generate-3d | < 4s | - | - |

## Accessibility Requirements

All pages must pass:
- Document structure (main landmark, headings)
- Image alt text
- Focusable interactive elements
- No empty buttons/links
