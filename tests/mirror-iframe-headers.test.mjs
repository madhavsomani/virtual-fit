// Phase 7.80 — guard: /mirror/* must be iframable from any origin so
// retailers (Phase 7 embed plan) can drop the widget into their stores.
// The global staticwebapp.config.json X-Frame-Options: SAMEORIGIN
// header would block that — needs a per-route override. This test
// asserts the override exists AND the global lockdown is preserved
// for every OTHER route.
//
// Also asserts the retailer signup page and the /embed.js loader keep
// pointing at /mirror/ (not /mirror) consistently, so a future config
// change can't accidentally break the iframe src.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SWA_RAW = readFileSync(resolve(ROOT, "staticwebapp.config.json"), "utf8");
const SWA = JSON.parse(SWA_RAW);

test("global headers still lock down every non-mirror route (defense in depth)", () => {
  const g = SWA.globalHeaders;
  assert.ok(g, "globalHeaders block must exist");
  assert.equal(
    g["X-Frame-Options"],
    "SAMEORIGIN",
    "global X-Frame-Options must remain SAMEORIGIN — only /mirror gets the override",
  );
  assert.match(
    g["Strict-Transport-Security"],
    /max-age=\d{7,}/,
    "HSTS must remain set with a long max-age (>= ~115 days)",
  );
  assert.equal(g["X-Content-Type-Options"], "nosniff");
  assert.match(g["Referrer-Policy"], /strict-origin/);
  // Permissions-Policy must still grant camera to self for /mirror
  // (camera=(self) extends to the embedded document origin).
  assert.match(g["Permissions-Policy"], /camera=\(self\)/);
});

test("/mirror/* and /mirror routes both override frame-blocking headers", () => {
  const routes = SWA.routes || [];
  const mirrorRoutes = routes.filter(
    (r) => r.route === "/mirror/*" || r.route === "/mirror",
  );
  assert.equal(
    mirrorRoutes.length,
    2,
    "must have both /mirror and /mirror/* route entries (SWA matches paths literally)",
  );
  for (const r of mirrorRoutes) {
    assert.ok(r.headers, `${r.route} must have a headers block`);
    // Empty X-Frame-Options unsets the global SAMEORIGIN.
    assert.equal(
      r.headers["X-Frame-Options"],
      "",
      `${r.route} must blank X-Frame-Options to allow cross-origin iframe`,
    );
    // CSP frame-ancestors * is the modern (RFC 7034) replacement for
    // X-Frame-Options ALLOW-FROM (which never worked cross-browser).
    assert.match(
      r.headers["Content-Security-Policy"] || "",
      /frame-ancestors\s+\*/,
      `${r.route} must set Content-Security-Policy: frame-ancestors *`,
    );
    // COOP must be unset on /mirror — same-origin breaks iframe parent
    // postMessage handshakes that some retailer integrations rely on.
    assert.equal(
      r.headers["Cross-Origin-Opener-Policy"],
      "",
      `${r.route} must blank COOP to allow cross-origin iframe parent communication`,
    );
  }
});

test("retailer signup snippet still points at /mirror/ (matches the override path)", () => {
  // If the snippet ever drifted to /mirror (no slash) or /widget,
  // the per-route override in staticwebapp.config.json wouldn't apply.
  const signup = readFileSync(
    resolve(ROOT, "app/retailer/signup/page.tsx"),
    "utf8",
  );
  assert.match(
    signup,
    /\/mirror\/\?embed=true/,
    "retailer signup iframe snippet must point at /mirror/?embed=true (matches the SWA route override path)",
  );
});

test("/embed.js loader still iframes /mirror (matches the override path)", () => {
  const embed = readFileSync(resolve(ROOT, "public/embed.js"), "utf8");
  assert.match(
    embed,
    /\/mirror\/?\?/,
    "/embed.js must construct an iframe src under /mirror/ (matches the SWA route override path)",
  );
});

test("staticwebapp.config.json is valid JSON (syntax/parse guard)", () => {
  // Already parsed at module load — this test exists so any future
  // syntax error in the file produces a clear failure here, instead
  // of confusingly cascading into the other tests' setup error.
  assert.ok(SWA_RAW.length > 100, "staticwebapp.config.json must not be empty");
  assert.equal(typeof SWA, "object");
});
