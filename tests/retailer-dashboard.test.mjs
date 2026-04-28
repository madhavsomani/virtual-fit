// Phase 8.8 — /retailer/dashboard contract tests (static analysis).
// Page is a heavy client component; we don't render it under jsdom — we
// test invariants through static checks + reuse the validator tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGarment } from "../app/lib/garment-schema.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(ROOT, "app/retailer/dashboard/page.tsx");
const LAYOUT = resolve(ROOT, "app/retailer/dashboard/layout.tsx");

test("dashboard page + layout exist", () => {
  assert.ok(existsSync(PAGE), "dashboard page.tsx missing");
  assert.ok(existsSync(LAYOUT), "dashboard layout.tsx missing");
});

test("dashboard is a client component (needs interactivity)", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src.split("\n").slice(0, 3).join("\n"), /['"]use client['"]/);
});

test("dashboard imports the formal garment validator (Phase 8.7)", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /validateGarment/);
  assert.match(src, /garment-schema/);
});

test("dashboard offers every fabric kind from KNOWN_FABRIC_KINDS", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /KNOWN_FABRIC_KINDS/);
});

test("dashboard offers every category in the schema enum", () => {
  const src = readFileSync(PAGE, "utf8");
  for (const c of ["tops", "outerwear", "bottoms", "dresses", "footwear", "accessories"]) {
    assert.ok(src.includes(`"${c}"`), `category '${c}' missing from CATEGORIES list`);
  }
});

test("dashboard layout sets noindex (private page)", () => {
  const src = readFileSync(LAYOUT, "utf8");
  assert.match(src, /index:\s*false/);
});

test("VISION GUARD: dashboard never imports a 2D garment renderer", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.ok(!src.includes("2d-overlay"));
  assert.ok(!src.includes("garmentTexture"));
});

test("VISION GUARD: dashboard surfaces the .glb requirement to retailers", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /\.glb/);
  assert.match(src, /3D-only|3d-only/i);
});

test("dashboard auth gate: requires shopId from /retailer/signup localStorage key", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /vfit:retailer:shopId/);
  assert.match(src, /\/retailer\/signup/);
});

test("dashboard persists gallery to localStorage with versioned key", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /vfit:retailer:dashboard:v1/);
});

test("dashboard 'Try on' link includes garment glb + fabric for PBR + dashboardId", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /\/mirror\?garment=/);
  assert.match(src, /fabric=/);
  assert.match(src, /dashboardId=/);
});

test("INTEGRATION: a retailer's typical valid submission passes Phase 8.7 validator", () => {
  // The dashboard builds this same `candidate` shape in useMemo.
  const candidate = {
    id: "acme-tee-v1",
    sku: "ACME-TEE-BLU-M",
    name: "Acme Tee",
    brand: "Acme Apparel",
    category: "tops",
    fabric: "cotton",
    price: 49,
    imageUrl: "/garments/tshirt-blue.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#4f7cff" },
    tagline: "soft and structured",
  };
  const { valid, errors } = validateGarment(candidate);
  assert.ok(valid, errors.join("; "));
});

test("INTEGRATION: missing glbUrl is caught client-side before submit", () => {
  const candidate = {
    id: "broken",
    name: "Broken",
    category: "tops",
    fabric: "cotton",
    imageUrl: "/x.png",
    glbUrl: "",
    palette: { primary: "#000000" },
  };
  const { valid, errors } = validateGarment(candidate);
  assert.ok(!valid);
  assert.ok(errors.some((e) => e.includes("glbUrl")));
});

test("INTEGRATION: a non-.glb glbUrl is rejected (vision)", () => {
  const candidate = {
    id: "broken",
    name: "Broken",
    category: "tops",
    fabric: "cotton",
    imageUrl: "/x.png",
    glbUrl: "/models/x.png",
    palette: { primary: "#000000" },
  };
  const { valid } = validateGarment(candidate);
  assert.ok(!valid);
});
