// Phase 8.13 — /api/v1/tryOn contract + OpenAPI emitter tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateTryOnRequest,
  validateTryOnResponse,
  buildOpenApiSpec,
  tryOnProblem,
  API_VERSION,
  RATE_LIMITS,
  JWT_REQUIREMENTS,
  SUPPORTED_SIZES,
  SUPPORTED_VIEWS,
  SUPPORTED_RETURN_FORMATS,
} from "../app/lib/tryon-api-spec.mjs";
import { emitOpenApi } from "../app/lib/build-openapi.mjs";
import { KNOWN_FABRIC_KINDS } from "../app/lib/pbr-fabric.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_OUT = resolve(ROOT, "public/api/v1/openapi.json");

const goodReq = () => ({
  garmentUrl: "https://cdn.virtualfit.app/models/demo-tshirt.glb",
  imageUrl: "https://cdn.example.com/selfies/u1.jpg",
});

test("validateTryOnRequest: accepts a minimal valid request + fills defaults", () => {
  const r = validateTryOnRequest(goodReq());
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.normalised.options.fabric, "cotton");
  assert.equal(r.normalised.options.size, "M");
  assert.equal(r.normalised.options.view, "front");
  assert.equal(r.normalised.options.returnFormat, "png");
});

test("validateTryOnRequest: rejects non-object body", () => {
  assert.equal(validateTryOnRequest(null).valid, false);
  assert.equal(validateTryOnRequest("nope").valid, false);
  assert.equal(validateTryOnRequest([]).valid, false);
});

test("validateTryOnRequest: garmentUrl must be https + end in .glb", () => {
  const r1 = validateTryOnRequest({ ...goodReq(), garmentUrl: "http://x.com/a.glb" });
  assert.equal(r1.valid, false);
  assert.ok(r1.errors.some((e) => /https/.test(e)));

  const r2 = validateTryOnRequest({ ...goodReq(), garmentUrl: "https://x.com/a.png" });
  assert.equal(r2.valid, false);
  assert.ok(r2.errors.some((e) => /\.glb/.test(e)));
});

test("validateTryOnRequest: rejects loopback/private hosts (SSRF guard)", () => {
  for (const u of [
    "https://localhost/a.glb",
    "https://127.0.0.1/a.glb",
    "https://192.168.0.1/a.glb",
    "https://10.0.0.1/a.glb",
  ]) {
    const r = validateTryOnRequest({ ...goodReq(), garmentUrl: u });
    assert.equal(r.valid, false, u);
    assert.ok(r.errors.some((e) => /private/.test(e)));
  }
});

test("validateTryOnRequest: imageUrl must be https + image ext", () => {
  const r1 = validateTryOnRequest({ ...goodReq(), imageUrl: "https://x.com/a.txt" });
  assert.equal(r1.valid, false);
  assert.ok(r1.errors.some((e) => /jpg\|png/.test(e)));
});

test("validateTryOnRequest: options.fabric coupled to KNOWN_FABRIC_KINDS", () => {
  const r1 = validateTryOnRequest({ ...goodReq(), options: { fabric: "denim" } });
  assert.equal(r1.valid, true);
  const r2 = validateTryOnRequest({ ...goodReq(), options: { fabric: "spaghetti" } });
  assert.equal(r2.valid, false);
});

test("validateTryOnRequest: options enums enforced", () => {
  for (const k of ["size", "view", "returnFormat"]) {
    const r = validateTryOnRequest({ ...goodReq(), options: { [k]: "bogus" } });
    assert.equal(r.valid, false, k);
  }
});

test("validateTryOnRequest: options must be object when present", () => {
  const r = validateTryOnRequest({ ...goodReq(), options: "no" });
  assert.equal(r.valid, false);
});

test("validateTryOnResponse: accepts a well-formed body", () => {
  const r = validateTryOnResponse({
    tryOnImageUrl: "https://cdn.virtualfit.app/r/u1/abc.png",
    jobId: "job_abcdef12",
    durationMs: 1234,
    modelVersion: "trellis-2025-q3",
    fabricUsed: "cotton",
    expiresAt: "2026-04-29T00:00:00Z",
  });
  assert.equal(r.valid, true, r.errors.join("|"));
});

test("validateTryOnResponse: rejects bad jobId, non-iso expiresAt, unknown fabric", () => {
  const r = validateTryOnResponse({
    tryOnImageUrl: "https://x/y.png",
    jobId: "not-a-job",
    durationMs: 1,
    modelVersion: "v",
    fabricUsed: "spaghetti",
    expiresAt: "yesterday",
  });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /jobId/.test(e)));
  assert.ok(r.errors.some((e) => /expiresAt/.test(e)));
  assert.ok(r.errors.some((e) => /fabricUsed/.test(e)));
});

test("tryOnProblem: requires 4xx/5xx status", () => {
  assert.throws(() => tryOnProblem({ status: 200 }), /4xx\/5xx/);
  const p = tryOnProblem({ status: 429, title: "Too Many Requests", detail: "60/min" });
  assert.equal(p.status, 429);
  assert.equal(p.instance, "/api/v1/tryOn");
  assert.match(p.type, /\/errors\/429$/);
});

test("buildOpenApiSpec: includes /tryOn POST + JWT security + 429 with Retry-After", () => {
  const s = buildOpenApiSpec();
  assert.equal(s.openapi, "3.1.0");
  assert.equal(s.info.version, API_VERSION.toString());
  assert.ok(s.paths["/tryOn"].post);
  assert.ok(s.components.securitySchemes.BearerJwt);
  assert.equal(s.components.securitySchemes.BearerJwt.bearerFormat, "JWT");
  const op = s.paths["/tryOn"].post;
  assert.ok(op.responses["200"].headers["X-RateLimit-Limit"]);
  assert.ok(op.responses["429"].headers["Retry-After"]);
});

test("buildOpenApiSpec: TryOnRequest schema enforces .glb pattern + fabric enum", () => {
  const s = buildOpenApiSpec();
  const req = s.components.schemas.TryOnRequest;
  assert.match(req.properties.garmentUrl.pattern, /\\\.glb/);
  const fab = req.properties.options.properties.fabric;
  assert.deepEqual(fab.enum, [...KNOWN_FABRIC_KINDS]);
});

test("emitOpenApi: writes /public/api/v1/openapi.json", () => {
  const r = emitOpenApi();
  assert.equal(r.ok, true);
  assert.ok(existsSync(SPEC_OUT));
  const parsed = JSON.parse(readFileSync(SPEC_OUT, "utf8"));
  assert.equal(parsed.openapi, "3.1.0");
  assert.ok(parsed.paths["/tryOn"]);
});

test("API_VERSION + RATE_LIMITS + JWT_REQUIREMENTS frozen", () => {
  assert.ok(Object.isFrozen(API_VERSION));
  assert.ok(Object.isFrozen(RATE_LIMITS));
  assert.ok(Object.isFrozen(JWT_REQUIREMENTS));
  assert.equal(API_VERSION.toString(), "v1.0.0");
  assert.ok(RATE_LIMITS.freeTier.requestsPerMinute > 0);
});

test("Supported enums are non-empty + frozen", () => {
  for (const e of [SUPPORTED_SIZES, SUPPORTED_VIEWS, SUPPORTED_RETURN_FORMATS]) {
    assert.ok(Object.isFrozen(e));
    assert.ok(e.length > 0);
  }
});

test("/api-docs page + layout exist + reference the spec", () => {
  const page = readFileSync(resolve(ROOT, "app/api-docs/page.tsx"), "utf8");
  const layout = readFileSync(resolve(ROOT, "app/api-docs/layout.tsx"), "utf8");
  assert.match(page, /\/api\/v1\/openapi\.json/);
  assert.match(page, /\/api\/v1\/tryOn/);
  assert.match(layout, /metadata/);
});

test("VISION GUARD: api-spec module never references 2D fallback or paid APIs", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/tryon-api-spec.mjs"), "utf8");
  assert.ok(!src.includes("2d-overlay"));
  assert.ok(!src.includes("garmentTexture"));
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com/i.test(src));
});
