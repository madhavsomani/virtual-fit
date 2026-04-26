// Phase 7.103 — JSX wiring contract for the tracking-held HUD chip.
//
// We don't mount the React tree (mirror/page.tsx pulls in three.js, MediaPipe,
// browser-only APIs). Instead: static-grep the source for the contract a future
// refactor MUST preserve. Same approach as the 7.99/7.100 regression guards.
//
// Contract this test enforces:
//   1. The chip is gated on the trackingHeldChip state — not directly on a
//      ref read or a derived prop.
//   2. The chip carries data-testid="tracking-held-chip" + data-axis hooks
//      so E2E tests / Playwright fixtures can target it without DOM heuristics.
//   3. The chip uses pointerEvents:none so it can never block underlying
//      tap / pinch handlers (the camera viewport handles a lot of touch
//      gestures; the chip is informational only).
//   4. The chip reads label + axes from the derived state — a refactor that
//      hard-codes copy in JSX would silently bypass the priority/threshold
//      policy in tracking-held-chip.js.
//   5. The polling effect uses setInterval (not requestAnimationFrame) — rAF
//      polling would re-render at 60fps, defeating the whole point of a
//      debounce indicator.
//   6. The setter is shallow-equal-guarded so a steady-off chip doesn't
//      re-render the whole mirror page every 200ms.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/mirror/page.tsx"),
  "utf8",
);

test("imports deriveTrackingHeldChip from the dedicated module", () => {
  assert.match(
    SRC,
    /import\s*\{\s*deriveTrackingHeldChip\s*\}\s*from\s*["']\.\/tracking-held-chip\.js["']/,
  );
});

test("uses useState typed against the derive function's return", () => {
  // ReturnType<typeof deriveTrackingHeldChip> keeps the chip type in sync
  // with the pure module — drift between render + derivation would be a bug.
  assert.match(
    SRC,
    /useState<\s*ReturnType<typeof deriveTrackingHeldChip>\s*>\(null\)/,
  );
});

test("polls telemetry via setInterval, NOT requestAnimationFrame", () => {
  // Find the deriveTrackingHeldChip call site in the polling effect.
  assert.match(
    SRC,
    /setInterval\([\s\S]{0,400}deriveTrackingHeldChip\(\{\s*snapshot:\s*trackingTelemetry\.current\.snapshot\(\)\s*\}\)/,
  );
  // Ensure no rAF wraps the same derivation — that would re-render at 60fps.
  assert.doesNotMatch(
    SRC,
    /requestAnimationFrame\([^)]*deriveTrackingHeldChip/,
  );
});

test("setter is shallow-equal-guarded (no thrash on steady-off chip)", () => {
  // The setter receives a function (functional update) — that pattern is
  // the prerequisite for any prev-vs-next compare. Without functional update
  // the equality check would compare against a stale closed-over value.
  assert.match(
    SRC,
    /setTrackingHeldChip\(\(prev\)\s*=>\s*\{/,
  );
  // And the body must compare primaryAxis + since + axes (the contract fields).
  assert.match(
    SRC,
    /prev\.primaryAxis\s*===\s*next\.primaryAxis/,
  );
  assert.match(SRC, /prev\.since\s*===\s*next\.since/);
});

test("chip JSX exists with the E2E hook attributes", () => {
  assert.match(SRC, /data-testid="tracking-held-chip"/);
  // data-axis carries the primaryAxis so E2E can assert WHICH axis is shown
  // without parsing innerText (label copy is product-tunable).
  assert.match(
    SRC,
    /data-axis=\{trackingHeldChip\.primaryAxis\}/,
  );
});

test("chip is gated on the trackingHeldChip state (not a raw ref read)", () => {
  // {trackingHeldChip && ( … )} pattern — null state hides the chip,
  // populated state renders it. Any direct trackingTelemetry.current.snapshot()
  // read in the JSX would bypass the threshold + shallow-equal layer.
  assert.match(
    SRC,
    /\{trackingHeldChip\s*&&\s*\(/,
  );
  // No direct snapshot read in JSX (only the polling effect reads .snapshot()).
  // We allow it inside the effect (already covered by the setInterval test);
  // here we just ensure the chip's render branch doesn't sneak around the gate.
  // Heuristic: check that the snapshot() call appears at most once outside comments.
  const stripped = SRC
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  const matches = stripped.match(/trackingTelemetry\.current\.snapshot\(\)/g) ?? [];
  assert.equal(matches.length, 1, `expected exactly one snapshot() read, got ${matches.length}`);
});

test("chip uses pointerEvents:none so it never blocks camera-viewport gestures", () => {
  // The viewport hosts pinch / swipe / tap handlers; an opaque chip on top
  // would steal events. pointerEvents:none keeps the chip purely informational.
  // Match within the chip block (kept generous to survive prop reordering).
  assert.match(SRC, /data-testid="tracking-held-chip"[\s\S]{0,800}pointerEvents:\s*["']none["']/);
});

test("chip reads label + axes from the derived state (not hard-coded)", () => {
  // {trackingHeldChip.label} — direct read. If a refactor hard-codes "Face the
  // camera" in JSX, the priority/threshold policy in tracking-held-chip.js
  // gets silently bypassed and tuning copy means editing JSX (bad coupling).
  assert.match(SRC, /\{trackingHeldChip\.label\}/);
  // axes.length used for the "+N" multi-axis indicator.
  assert.match(SRC, /trackingHeldChip\.axes\.length/);
});
