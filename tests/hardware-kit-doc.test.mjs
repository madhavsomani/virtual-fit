// Phase 8.16 — BYO Hardware Kit doc + cross-link guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(ROOT, "..");
const DOC = resolve(REPO, "docs/hardware-kit.md");

test("docs/hardware-kit.md exists at repo root", () => {
  assert.ok(existsSync(DOC), `${DOC} must exist`);
});

const MD = existsSync(DOC) ? readFileSync(DOC, "utf8") : "";

test("hardware-kit doc covers the 5 mandated topics (display, Mac mini, camera, mount, Tailscale)", () => {
  for (const heading of ["Compute", "Display", "Camera", "Mount", "Networking"]) {
    assert.match(MD, new RegExp(`^##\\s.*${heading}`, "m"), `missing section: ${heading}`);
  }
  assert.match(MD, /Mac mini/i);
  assert.match(MD, /Tailscale/);
});

test("hardware-kit doc explicitly warns retailers NEVER to publish *.ts.net URLs in the embed", () => {
  // The doc is allowed (and encouraged) to mention Tailscale for back-office
  // tooling, but it MUST contain a prominent warning that ts.net URLs do
  // not belong in the public <virtualfit-mirror> embed attribute.
  assert.match(MD, /never\s+\S*\s*appear/i, "must contain a 'never appear' warning");
  assert.match(MD, /\*\.ts\.net/, "warning must reference *.ts.net specifically");
  assert.match(MD, /<virtualfit-mirror/, "warning must reference the embed element by name");
});

test("hardware-kit doc lists at least 3 specific compute picks + price column", () => {
  // Buyers need an at-a-glance table.
  const computeMentions = (MD.match(/Mac mini|Mac Studio|NUC|Jetson|Raspberry Pi/gi) || []).length;
  assert.ok(computeMentions >= 5, `expected >= 5 compute mentions, got ${computeMentions}`);
  assert.match(MD, /\$\s?\d{2,4}/, "doc must include at least one $ price");
});

test("hardware-kit doc cross-links /pricing and /embed-docs (so retailers find next steps)", () => {
  assert.match(MD, /\/pricing/);
  assert.match(MD, /\/embed-docs/);
  assert.match(MD, /\/api-docs/);
});

test("VISION GUARD: hardware-kit doc never recommends paid AI APIs (only HF Spaces / HF Inference)", () => {
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com|replicate\.com\/pricing/i.test(MD),
    "hardware-kit doc must not recommend paid AI APIs");
  // Positive assertion: must mention our approved free pipeline.
  assert.match(MD, /TRELLIS/, "must mention TRELLIS (our free 3D pipeline)");
  assert.match(MD, /Hugging Face|HF/i, "must mention Hugging Face / HF (our free model host)");
});

test("VISION GUARD: hardware-kit doc never recommends 2D fallback rendering", () => {
  assert.ok(!/2d (overlay|fallback|rendering)/i.test(MD));
  assert.ok(!/garmentTexture/i.test(MD));
});

test("hardware-kit doc has a TL;DR starter-kit table with total ≤ $2,000", () => {
  // Sanity guard on the bill-of-materials anchor figure.
  assert.match(MD, /TL;DR/);
  assert.match(MD, /Total/i);
  // Extract the headline starter-kit total and assert it stays under
  // $2k so doc edits don't quietly drift the entry-price story.
  const m = MD.match(/Total[^\n]*\$\s?([0-9,]+)/i);
  assert.ok(m, "starter-kit total must be present");
  const total = Number(m[1].replace(/,/g, ""));
  assert.ok(total > 0 && total <= 2000, `starter-kit total ${total} must be in (0, 2000]`);
});

test("/embed-docs page cross-links to /docs/hardware-kit.md (retailer onboarding flow)", () => {
  // The embed-docs page is where Shopify retailers land; once they like
  // the snippet, the next question is "what hardware do I need in
  // store?". The link must be present so they don't have to ask in
  // Discord.
  const PAGE = resolve(ROOT, "app/embed-docs/page.tsx");
  const body = readFileSync(PAGE, "utf8");
  assert.match(body, /hardware-kit/, "/embed-docs page must reference the hardware-kit doc");
});
