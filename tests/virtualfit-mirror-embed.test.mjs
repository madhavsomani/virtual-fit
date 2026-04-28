// Phase 8.14 — <virtualfit-mirror> embed contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMirrorUrl,
  clampHeight,
  parseInboundMessage,
  createMirrorIframe,
  VFIT_EMBED_VERSION,
  VFIT_EMBED_DEFAULTS,
} from "../app/lib/virtualfit-mirror-embed.mjs";
import { emitEmbed } from "../app/lib/build-embed.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EMBED_OUT = resolve(ROOT, "public/embed/virtualfit-mirror.js");

test("buildMirrorUrl: minimal valid call", () => {
  const u = buildMirrorUrl({ garment: "https://cdn/x.glb" });
  assert.match(u, /^https:\/\/virtualfit\.app\/mirror\?/);
  assert.match(u, /garment=https%3A%2F%2Fcdn%2Fx\.glb/);
  assert.match(u, /embed=1/);
});

test("buildMirrorUrl: all params propagate + URL-encoded", () => {
  const u = buildMirrorUrl({
    origin: "https://staging.virtualfit.app/",
    garment: "https://cdn/x.glb?v=2",
    fabric: "denim",
    mode: "footwear",
    analytics: "shop_xyz.myshopify.com",
  });
  assert.match(u, /^https:\/\/staging\.virtualfit\.app\/mirror\?/);
  assert.match(u, /fabric=denim/);
  assert.match(u, /mode=footwear/);
  assert.match(u, /shop=shop_xyz/);
});

test("buildMirrorUrl: rejects non-https origin", () => {
  assert.throws(() => buildMirrorUrl({ origin: "http://x", garment: "https://x.glb" }), /https/);
});

test("buildMirrorUrl: rejects non-glb garment (3D-only)", () => {
  assert.throws(() => buildMirrorUrl({ garment: "https://x/x.png" }), /\.glb/);
  assert.throws(() => buildMirrorUrl({ garment: "http://x/x.glb" }), /\.glb/);
  assert.throws(() => buildMirrorUrl({ garment: undefined }), /\.glb/);
});

test("buildMirrorUrl: rejects unknown mode", () => {
  assert.throws(() => buildMirrorUrl({ garment: "https://x.glb", mode: "hat" }), /mode/);
});

test("clampHeight: defaults + bounds", () => {
  assert.equal(clampHeight(undefined), VFIT_EMBED_DEFAULTS.height);
  assert.equal(clampHeight("xyz"), VFIT_EMBED_DEFAULTS.height);
  assert.equal(clampHeight(10), VFIT_EMBED_DEFAULTS.minHeight);
  assert.equal(clampHeight(100000), VFIT_EMBED_DEFAULTS.maxHeight);
  assert.equal(clampHeight("720"), 720);
});

test("parseInboundMessage: ignores untrusted origin", () => {
  const r = parseInboundMessage(
    { origin: "https://evil.example.com", data: { type: "vfit:ready" } },
    { trustedOrigin: "https://virtualfit.app" },
  );
  assert.equal(r, null);
});

test("parseInboundMessage: ignores unknown event types", () => {
  const r = parseInboundMessage(
    { origin: "https://virtualfit.app", data: { type: "vfit:do-evil" } },
    { trustedOrigin: "https://virtualfit.app" },
  );
  assert.equal(r, null);
});

test("parseInboundMessage: passes through allowed events with payload", () => {
  for (const t of VFIT_EMBED_DEFAULTS.allowedEvents) {
    const r = parseInboundMessage(
      { origin: "https://virtualfit.app", data: { type: t, payload: { x: 1 } } },
      { trustedOrigin: "https://virtualfit.app" },
    );
    assert.deepEqual(r, { type: t, payload: { x: 1 } });
  }
});

test("parseInboundMessage: defends against non-object data", () => {
  const r = parseInboundMessage(
    { origin: "https://virtualfit.app", data: "evil-string" },
    { trustedOrigin: "https://virtualfit.app" },
  );
  assert.equal(r, null);
});

test("createMirrorIframe: sets sandbox + camera/xr allow + lazy load", () => {
  // Tiny fake document so we don't need jsdom.
  const fakeDoc = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        attrs: {},
        style: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        getAttribute(k) { return this.attrs[k]; },
      };
      return el;
    },
  };
  const f = createMirrorIframe(fakeDoc, { src: "https://virtualfit.app/mirror?garment=x", height: 720 });
  assert.equal(f.tagName, "IFRAME");
  assert.equal(f.src, "https://virtualfit.app/mirror?garment=x");
  assert.match(f.allow, /camera/);
  assert.match(f.allow, /xr-spatial-tracking/);
  assert.equal(f.getAttribute("sandbox"), "allow-scripts allow-same-origin");
  assert.equal(f.style.height, "720px");
  assert.equal(f.loading, "lazy");
  assert.equal(f.referrerPolicy, "strict-origin-when-cross-origin");
});

test("VFIT_EMBED_DEFAULTS frozen + version semver", () => {
  assert.ok(Object.isFrozen(VFIT_EMBED_DEFAULTS));
  assert.ok(Object.isFrozen(VFIT_EMBED_DEFAULTS.allowedEvents));
  assert.match(VFIT_EMBED_VERSION, /^\d+\.\d+\.\d+$/);
});

test("emitEmbed: writes /public/embed/virtualfit-mirror.js with header", () => {
  const r = emitEmbed();
  assert.equal(r.ok, true);
  assert.ok(existsSync(EMBED_OUT));
  const out = readFileSync(EMBED_OUT, "utf8");
  assert.match(out, /virtualfit-mirror web component/);
  assert.match(out, /customElements\.define\("virtualfit-mirror"/);
  assert.match(out, /export function buildMirrorUrl/);
});

test("/embed-docs page + layout exist + reference embed URL + element", () => {
  const page = readFileSync(resolve(ROOT, "app/embed-docs/page.tsx"), "utf8");
  const layout = readFileSync(resolve(ROOT, "app/embed-docs/layout.tsx"), "utf8");
  assert.match(page, /\/embed\/virtualfit-mirror\.js/);
  assert.match(page, /virtualfit-mirror/);
  assert.match(page, /vfit:tryon-snapshot/);
  assert.match(layout, /metadata/);
});

test("VISION GUARD: embed module never references 2D fallback or paid APIs or Tailscale", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/virtualfit-mirror-embed.mjs"), "utf8");
  assert.ok(!src.includes("2d-overlay"));
  assert.ok(!src.includes("garmentTexture"));
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com/i.test(src));
  assert.ok(!/ts\.net|tailscale/i.test(src));
});
