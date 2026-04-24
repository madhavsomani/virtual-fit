// Phase 7.51 — guard: staticwebapp.config.json declares the security
// response headers we need for a webcam-using app on a public domain.
//
// Pre-7.51 the SWA config had zero globalHeaders. Every response shipped
// without HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
// COOP, or X-Frame-Options. The mirror page uses getUserMedia and loads
// MediaPipe + GLBs from CDNs — without explicit headers, MIME sniffing,
// referer leakage, MITM downgrade on first visit, and unscoped device
// permissions were all live exposures. Same trust-the-deploy class as
// Phases 7.45 + 7.50.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SWA = resolve(ROOT, "staticwebapp.config.json");

const config = JSON.parse(readFileSync(SWA, "utf8"));
const H = config.globalHeaders || {};

// Header lookups must be case-insensitive (HTTP) but Azure SWA stores
// them verbatim. Normalize for our reads.
function get(name) {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(H)) {
    if (k.toLowerCase() === want) return v;
  }
  return undefined;
}

test("staticwebapp.config.json has a globalHeaders block", () => {
  assert.ok(
    config.globalHeaders && typeof config.globalHeaders === "object" && !Array.isArray(config.globalHeaders),
    "staticwebapp.config.json must declare a `globalHeaders` object so security headers ship on every response.",
  );
  assert.ok(Object.keys(H).length > 0, "globalHeaders is empty — no security headers will ship.");
});

test("Strict-Transport-Security pins HSTS for >=1 year and includes subdomains", () => {
  const hsts = get("Strict-Transport-Security");
  assert.ok(hsts, "Strict-Transport-Security header missing — first-visit MITM downgrade exposure remains.");
  const m = hsts.match(/max-age=(\d+)/i);
  assert.ok(m, `HSTS missing max-age: ${hsts}`);
  assert.ok(
    Number(m[1]) >= 31_536_000,
    `HSTS max-age (${m[1]}) must be >= 31536000 (1 year) for browser/preload acceptance.`,
  );
  assert.match(hsts, /includeSubDomains/i, "HSTS must include `includeSubDomains`.");
});

test("X-Content-Type-Options is exactly `nosniff`", () => {
  assert.equal(
    get("X-Content-Type-Options"),
    "nosniff",
    "X-Content-Type-Options must be `nosniff` to stop MIME sniffing on CDN-served assets.",
  );
});

test("Referrer-Policy is strict-origin-when-cross-origin (or stricter)", () => {
  const rp = get("Referrer-Policy");
  assert.ok(rp, "Referrer-Policy missing — full /mirror?garment=<url> paths leak to every CDN fetch.");
  const allowed = new Set([
    "strict-origin-when-cross-origin",
    "strict-origin",
    "same-origin",
    "no-referrer",
  ]);
  assert.ok(
    allowed.has(rp),
    `Referrer-Policy (${rp}) must be one of: ${[...allowed].join(", ")}`,
  );
});

test("Permissions-Policy scopes camera to self and disables microphone+geolocation", () => {
  const pp = get("Permissions-Policy");
  assert.ok(pp, "Permissions-Policy missing — webcam/mic/geo scoping not asserted.");
  assert.match(
    pp,
    /camera=\(self\)/,
    "Permissions-Policy must declare `camera=(self)` — the mirror page is the only intended camera consumer.",
  );
  assert.match(
    pp,
    /microphone=\(\)/,
    "Permissions-Policy must declare `microphone=()` — VirtualFit never uses the mic.",
  );
  assert.match(
    pp,
    /geolocation=\(\)/,
    "Permissions-Policy must declare `geolocation=()` — VirtualFit never uses geolocation.",
  );
});

test("X-Frame-Options + Cross-Origin-Opener-Policy declared (clickjacking + window-isolation)", () => {
  const xfo = get("X-Frame-Options");
  assert.ok(xfo, "X-Frame-Options missing.");
  assert.match(
    String(xfo).toUpperCase(),
    /^(DENY|SAMEORIGIN)$/,
    `X-Frame-Options (${xfo}) must be DENY or SAMEORIGIN.`,
  );
  const coop = get("Cross-Origin-Opener-Policy");
  assert.ok(coop, "Cross-Origin-Opener-Policy missing.");
  assert.match(
    String(coop),
    /^(same-origin|same-origin-allow-popups)$/,
    `Cross-Origin-Opener-Policy (${coop}) must be same-origin or same-origin-allow-popups.`,
  );
});
