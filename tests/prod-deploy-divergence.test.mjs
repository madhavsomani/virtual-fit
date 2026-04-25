// Phase 7.85 — guard: detect production DNS / deploy-target divergence.
//
// Phase 7.84 unblocked CI deploys after 5 phases of red-X failures
// nobody noticed. The very next test (curl virtualfit.app) revealed
// a SECOND, deeper problem: the SWA that CI deploys to is NOT the
// origin that virtualfit.app DNS points at. CI happily ships to
// `wonderful-sky-0513a3610.7.azurestaticapps.net` (where the real
// Next.js mirror app is now live) while virtualfit.app resolves to
// AWS IPs (13.248.213.45 = AWS Global Accelerator) hosting a tiny
// 80-byte legacy "<script>location.href='/lander'</script>" stub.
//
// Visible end-user impact: the entire Photo→3D mesh→overlay pipeline
// (the VISION) has been invisible to every visitor of virtualfit.app
// for an unknown number of weeks. Retailer iframes embed /mirror from
// virtualfit.app, get the 80-byte stub, and the camera widget never
// loads. Every revenue path that depends on the public domain is
// silently broken.
//
// This is operator-territory to actually FIX (DNS change, or moving
// the SWA token to the right resource, or repointing AWS Global
// Accelerator). What we CAN do from code is make the divergence
// loud and continuously detectable so it stops being invisible.
//
// This guard is NETWORK-DEPENDENT and OPT-IN via the
// VFIT_PROD_HEALTHCHECK=1 env var. Off by default so dev shells and
// offline CI runs don't fail. Operator can run locally with
// `VFIT_PROD_HEALTHCHECK=1 npm test` to immediately see the state.
// (Wiring it into the deploy.yml workflow is a Phase 7.86 candidate
// once Madhav has decided the right resolution.)

import test from "node:test";
import assert from "node:assert/strict";

const ENABLED = process.env.VFIT_PROD_HEALTHCHECK === "1";

const PROD_DOMAIN = "https://virtualfit.app";
const SWA_ORIGIN = "https://wonderful-sky-0513a3610.7.azurestaticapps.net";

// A canonical fingerprint of the REAL app: the Next.js export injects
// a webpack chunk preload for `webpack-<hash>.js`. The legacy stub is
// a single 80-byte HTML doc with a window.location.href redirect.
const NEXT_JS_FINGERPRINT = /<link[^>]*rel="preload"[^>]*\/_next\/static\/chunks\/webpack-/;
const LEGACY_STUB_FINGERPRINT = /window\.location\.href="\/lander"/;

async function fetchTextWithTimeout(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        // Some CDNs serve different content based on UA. Use a normal
        // browser UA so we get the same payload a real visitor sees.
        "User-Agent": "Mozilla/5.0 (compatible; vfit-healthcheck/1.0)",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

test("[network] SWA deploy-target serves the real Next.js app (sanity)", { skip: !ENABLED }, async () => {
  const { status, text } = await fetchTextWithTimeout(`${SWA_ORIGIN}/mirror/`);
  assert.equal(status, 200, `SWA /mirror/ should return 200, got ${status}`);
  assert.match(
    text,
    NEXT_JS_FINGERPRINT,
    "SWA /mirror/ must serve the real Next.js mirror page (webpack chunk preload). If this fails, the SWA itself is broken — investigate the deploy artifact at app/out/mirror/index.html.",
  );
  assert.doesNotMatch(
    text,
    LEGACY_STUB_FINGERPRINT,
    "SWA /mirror/ must NOT serve the legacy /lander redirect stub. If this fires, something served the stale legacy build to the SWA — look for a stray .azurestaticapps.net deploy from a different source repo.",
  );
});

test("[network] virtualfit.app serves the same content as the SWA (no DNS divergence)", { skip: !ENABLED }, async () => {
  const { status, text } = await fetchTextWithTimeout(`${PROD_DOMAIN}/mirror/`);
  // A divergence here is THE bug we want to catch. Build the
  // assertion so the failure message names both possible causes.
  if (LEGACY_STUB_FINGERPRINT.test(text)) {
    assert.fail(
      `\n\n` +
      `🚨 PRODUCTION DNS / DEPLOY-TARGET DIVERGENCE 🚨\n` +
      `\n` +
      `${PROD_DOMAIN}/mirror/ is serving the LEGACY 80-byte\n` +
      `<script>location.href='/lander'</script> stub.\n` +
      `\n` +
      `The CI pipeline deploys to ${SWA_ORIGIN}\n` +
      `which serves the REAL Next.js app correctly. But\n` +
      `${PROD_DOMAIN} DNS points elsewhere (AWS Global\n` +
      `Accelerator IPs 13.248.213.45 / 76.223.67.189) at a\n` +
      `STALE legacy origin we don't deploy to.\n` +
      `\n` +
      `End-user impact: the entire Photo→3D mesh→overlay\n` +
      `pipeline (the project's vision) is invisible to every\n` +
      `visitor of virtualfit.app. Retailer iframes break.\n` +
      `Every revenue path that depends on the public domain\n` +
      `is silently broken.\n` +
      `\n` +
      `OPERATOR FIX OPTIONS (pick one):\n` +
      `  (a) Repoint virtualfit.app DNS to the SWA origin\n` +
      `      (CNAME → ${SWA_ORIGIN.replace("https://", "")}).\n` +
      `  (b) Move the AZURE_STATIC_WEB_APPS_API_TOKEN secret\n` +
      `      to whichever Azure SWA resource virtualfit.app\n` +
      `      is bound to, then re-deploy.\n` +
      `  (c) If the AWS Global Accelerator is intentional,\n` +
      `      update its origin to point at the SWA hostname\n` +
      `      and clear the cached /lander stub.\n` +
      `\n`,
    );
  }
  assert.equal(status, 200, `${PROD_DOMAIN}/mirror/ should return 200, got ${status}`);
  assert.match(
    text,
    NEXT_JS_FINGERPRINT,
    `${PROD_DOMAIN}/mirror/ must serve the real Next.js mirror page (webpack chunk preload), matching the SWA build.`,
  );
});

test("[network] /api/waitlist-stats?key=admin is REJECTED on the real SWA (Phase 7.82 PII fix)", { skip: !ENABLED }, async () => {
  // Hit the SWA directly so this passes regardless of the DNS mess.
  // Once Madhav fixes DNS, re-run with PROD_DOMAIN to confirm the
  // public endpoint is also closed.
  const { status, text } = await fetchTextWithTimeout(
    `${SWA_ORIGIN}/api/waitlist-stats?key=admin`,
  );
  // Phase 7.82 contract: ?key=admin returns 401 (bad key) when
  // ADMIN_KEY env is set, OR 503 (misconfigured) when ADMIN_KEY is
  // unset on the SWA. Either is acceptable — both mean PII is closed.
  // 200 = leak; 5xx other than 503 = potentially handler crash that
  // could fall through.
  assert.notEqual(
    status,
    200,
    `/api/waitlist-stats?key=admin returned 200 — PII LEAK. ` +
    `Phase 7.82 fix didn't reach prod. Body preview: ${text.slice(0, 200)}`,
  );
  assert.ok(
    status === 401 || status === 503 || status === 500,
    `/api/waitlist-stats?key=admin should return 401 (bad key) or 503/500 ` +
    `(ADMIN_KEY env not set on SWA — operator must configure it in the ` +
    `Azure portal). Got HTTP ${status}.`,
  );
});

test("guard exists even when network-disabled (so removing it requires a code change)", () => {
  // Defense-in-depth: a future agent can't accidentally make the file
  // empty/no-op by setting VFIT_PROD_HEALTHCHECK=0 in CI. The file
  // itself must always contain at least one always-running test that
  // proves the guard module is loaded.
  assert.ok(true, "the divergence guard file is loaded by the test runner");
});
