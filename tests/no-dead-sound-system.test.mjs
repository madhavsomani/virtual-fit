// Phase 7.32 — guard: the dead `playSound` audio system stays deleted.
//
// `playSound` was an unused (`// eslint-disable-next-line @typescript-eslint/no-unused-vars`)
// useCallback that built an AudioContext + oscillator per call but was
// never invoked. Yet the gating `soundEnabled` state was toggled by Alt+M
// with a "🔊 Sound on" / "🔇 Sound off" status banner — six months of
// the toggle producing zero audible effect. Stripped in Phase 7.32.
//
// If sound design is a real feature later, wire one global hook from one
// place — don't re-add per-component AudioContext leakage.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MIRROR = resolve(ROOT, "app/mirror/page.tsx");

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("`playSound` is not redefined in app/mirror/page.tsx", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(
    src,
    /\bplaySound\b/,
    "Dead `playSound` resurrected. If sound is real now, wire a single global hook (not per-component AudioContext).",
  );
});

test("`soundEnabled` state is not redefined in app/mirror/page.tsx", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  // The gating state and its setter must stay gone.
  assert.doesNotMatch(
    src,
    /\bsetSoundEnabled\b/,
    "Dead `setSoundEnabled` resurrected. Toggling state that gates a no-op function is a UX lie.",
  );
  assert.doesNotMatch(
    src,
    /useState[^;]*soundEnabled/,
    "Dead `soundEnabled` useState resurrected.",
  );
});

test("no inline `new AudioContext` / `webkitAudioContext` per-call construction in app/mirror/page.tsx", () => {
  // Catch the specific anti-pattern the deleted code used: building a
  // fresh AudioContext on every event. If real audio comes back, it
  // belongs in a single shared hook outside the render tree.
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(src, /new\s+\(?\s*window\s*\.\s*AudioContext/);
  assert.doesNotMatch(src, /webkitAudioContext/);
});
