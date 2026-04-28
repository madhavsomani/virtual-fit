// Phase 8.13 — Public API contract for /api/v1/tryOn.
//
// Static export = no server today, so this module is the single source
// of truth for the request/response shapes + JWT/rate-limit semantics.
// The same validators run in (a) build-time spec emitter, (b) tests,
// and (c) future server runtime when we ship one.
//
// Endpoint:
//   POST /api/v1/tryOn
//   Authorization: Bearer <JWT>
//   Content-Type: application/json
//
// Request body:
//   {
//     garmentUrl: "https://.../tee.glb",   // .glb only — we are 3D-only
//     imageUrl:   "https://.../selfie.jpg",
//     options?: {
//       fabric?:  "cotton" | "denim" | "silk" | ...,   // KNOWN_FABRIC_KINDS
//       size?:    "XS" | "S" | "M" | "L" | "XL" | "XXL",
//       view?:    "front" | "side" | "back",
//       returnFormat?: "png" | "webp" | "jpeg",
//     }
//   }
//
// Response (200):
//   { tryOnImageUrl, jobId, durationMs, modelVersion, fabricUsed, expiresAt }
//
// Errors (RFC 7807): { type, title, status, detail, instance }
//
// Auth: Bearer JWT (HS256, audience "tryon.v1", exp required, max 1h
// from iat). Rate limit headers on every response:
//   X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
// Default tier: 60 req/min/key. Exceeded → 429 with Retry-After.

import { KNOWN_FABRIC_KINDS } from "./pbr-fabric.mjs";

export const API_VERSION = Object.freeze({
  major: 1,
  minor: 0,
  patch: 0,
  toString() { return `v${this.major}.${this.minor}.${this.patch}`; },
});

export const SUPPORTED_SIZES = Object.freeze(["XS", "S", "M", "L", "XL", "XXL"]);
export const SUPPORTED_VIEWS = Object.freeze(["front", "side", "back"]);
export const SUPPORTED_RETURN_FORMATS = Object.freeze(["png", "webp", "jpeg"]);

export const RATE_LIMITS = Object.freeze({
  freeTier: { requestsPerMinute: 60, requestsPerDay: 5_000 },
  proTier:  { requestsPerMinute: 600, requestsPerDay: 100_000 },
});

export const JWT_REQUIREMENTS = Object.freeze({
  algorithm: "HS256",
  audience: "tryon.v1",
  maxLifetimeSeconds: 3600,
  requiredClaims: Object.freeze(["sub", "aud", "exp", "iat"]),
});

// Free tier ships with restrictive content rules. We require https:
// to keep the static-export site from leaking mixed-content garments,
// reject obviously private hosts, and require a .glb extension on the
// garment URL (3D-only rule).
const HTTPS_RE = /^https:\/\//i;
const GLB_RE = /\.glb(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|heic)(\?.*)?$/i;
const PRIVATE_HOST_RE = /^(https?:\/\/)?(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|\[::1\])/i;

function isStr(v, min = 1, max = 2048) {
  return typeof v === "string" && v.length >= min && v.length <= max;
}

/**
 * Validate an inbound JSON body. Returns `{valid, errors, normalised}`
 * where `normalised` is the request with optional defaults filled in.
 */
export function validateTryOnRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, errors: ["body: must be an object"], normalised: null };
  }
  const { garmentUrl, imageUrl, options } = body;

  if (!isStr(garmentUrl)) errors.push("garmentUrl: required string");
  else {
    if (!HTTPS_RE.test(garmentUrl)) errors.push("garmentUrl: must be https://");
    if (PRIVATE_HOST_RE.test(garmentUrl)) errors.push("garmentUrl: private/loopback hosts not allowed");
    if (!GLB_RE.test(garmentUrl)) errors.push("garmentUrl: must end with .glb (3D-only)");
  }

  if (!isStr(imageUrl)) errors.push("imageUrl: required string");
  else {
    if (!HTTPS_RE.test(imageUrl)) errors.push("imageUrl: must be https://");
    if (PRIVATE_HOST_RE.test(imageUrl)) errors.push("imageUrl: private/loopback hosts not allowed");
    if (!IMAGE_EXT_RE.test(imageUrl)) errors.push("imageUrl: must be jpg|png|webp|avif|heic");
  }

  let normOpts = {};
  if (options !== undefined) {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      errors.push("options: must be an object when present");
    } else {
      const { fabric, size, view, returnFormat } = options;
      if (fabric !== undefined && !KNOWN_FABRIC_KINDS.includes(fabric)) {
        errors.push(`options.fabric: must be one of ${KNOWN_FABRIC_KINDS.join(",")}`);
      }
      if (size !== undefined && !SUPPORTED_SIZES.includes(size)) {
        errors.push(`options.size: must be one of ${SUPPORTED_SIZES.join(",")}`);
      }
      if (view !== undefined && !SUPPORTED_VIEWS.includes(view)) {
        errors.push(`options.view: must be one of ${SUPPORTED_VIEWS.join(",")}`);
      }
      if (returnFormat !== undefined && !SUPPORTED_RETURN_FORMATS.includes(returnFormat)) {
        errors.push(`options.returnFormat: must be one of ${SUPPORTED_RETURN_FORMATS.join(",")}`);
      }
      normOpts = {
        fabric: fabric ?? "cotton",
        size: size ?? "M",
        view: view ?? "front",
        returnFormat: returnFormat ?? "png",
      };
    }
  } else {
    normOpts = { fabric: "cotton", size: "M", view: "front", returnFormat: "png" };
  }

  if (errors.length) return { valid: false, errors, normalised: null };
  return {
    valid: true,
    errors: [],
    normalised: { garmentUrl, imageUrl, options: normOpts },
  };
}

const JOB_ID_RE = /^job_[a-z0-9]{8,32}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function validateTryOnResponse(body) {
  const errors = [];
  if (!body || typeof body !== "object") return { valid: false, errors: ["body: must be an object"] };
  const { tryOnImageUrl, jobId, durationMs, modelVersion, fabricUsed, expiresAt } = body;
  if (!isStr(tryOnImageUrl) || !HTTPS_RE.test(tryOnImageUrl)) {
    errors.push("tryOnImageUrl: required https://");
  }
  if (!isStr(jobId) || !JOB_ID_RE.test(jobId)) errors.push("jobId: must match /^job_[a-z0-9]{8,32}$/");
  if (!Number.isInteger(durationMs) || durationMs < 0) errors.push("durationMs: required non-negative integer");
  if (!isStr(modelVersion)) errors.push("modelVersion: required string");
  if (!KNOWN_FABRIC_KINDS.includes(fabricUsed)) errors.push("fabricUsed: must be a known fabric");
  if (!isStr(expiresAt) || !ISO_RE.test(expiresAt)) errors.push("expiresAt: required ISO-8601 UTC");
  return { valid: errors.length === 0, errors };
}

/**
 * Build an RFC 7807 problem-details object. Used by the future server
 * runtime *and* exercised in the spec page so docs match behaviour.
 */
export function tryOnProblem({ status, title, detail, instance, type }) {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new Error("tryOnProblem: status must be a 4xx/5xx integer");
  }
  return {
    type: type || `https://virtualfit.app/errors/${status}`,
    title: title || "Bad Request",
    status,
    detail: detail || "",
    instance: instance || "/api/v1/tryOn",
  };
}

/** Emit the canonical OpenAPI 3.1 document for serving at build time. */
export function buildOpenApiSpec() {
  const fabricEnum = [...KNOWN_FABRIC_KINDS];
  return {
    openapi: "3.1.0",
    info: {
      title: "VirtualFit Try-On API",
      version: API_VERSION.toString(),
      description:
        "Submit a garment GLB + a customer image and get back a 3D-rendered try-on image. JWT-authenticated, rate-limited, no paid APIs in the pipeline.",
      license: { name: "Apache-2.0" },
      contact: { name: "VirtualFit", url: "https://virtualfit.app" },
    },
    servers: [
      { url: "https://api.virtualfit.app/api/v1", description: "Production (planned)" },
    ],
    security: [{ BearerJwt: [] }],
    paths: {
      "/tryOn": {
        post: {
          summary: "Render a try-on image",
          operationId: "tryOn",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TryOnRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Try-on image rendered",
              headers: {
                "X-RateLimit-Limit": { schema: { type: "integer" } },
                "X-RateLimit-Remaining": { schema: { type: "integer" } },
                "X-RateLimit-Reset": { schema: { type: "integer" }, description: "Unix epoch seconds" },
              },
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TryOnResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/Problem" },
            "401": { $ref: "#/components/responses/Problem" },
            "403": { $ref: "#/components/responses/Problem" },
            "422": { $ref: "#/components/responses/Problem" },
            "429": {
              description: "Rate limit exceeded",
              headers: {
                "Retry-After": { schema: { type: "integer" } },
              },
              content: {
                "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerJwt: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            `HS256 JWT, audience '${JWT_REQUIREMENTS.audience}', exp <= ${JWT_REQUIREMENTS.maxLifetimeSeconds}s. Required claims: ${JWT_REQUIREMENTS.requiredClaims.join(", ")}.`,
        },
      },
      schemas: {
        TryOnRequest: {
          type: "object",
          required: ["garmentUrl", "imageUrl"],
          additionalProperties: false,
          properties: {
            garmentUrl: { type: "string", format: "uri", pattern: "\\.glb(\\?.*)?$", description: "https URL ending in .glb (3D-only)" },
            imageUrl:   { type: "string", format: "uri" },
            options: {
              type: "object",
              additionalProperties: false,
              properties: {
                fabric: { type: "string", enum: fabricEnum },
                size:   { type: "string", enum: [...SUPPORTED_SIZES] },
                view:   { type: "string", enum: [...SUPPORTED_VIEWS] },
                returnFormat: { type: "string", enum: [...SUPPORTED_RETURN_FORMATS] },
              },
            },
          },
        },
        TryOnResponse: {
          type: "object",
          required: ["tryOnImageUrl", "jobId", "durationMs", "modelVersion", "fabricUsed", "expiresAt"],
          properties: {
            tryOnImageUrl: { type: "string", format: "uri" },
            jobId:         { type: "string", pattern: "^job_[a-z0-9]{8,32}$" },
            durationMs:    { type: "integer", minimum: 0 },
            modelVersion:  { type: "string" },
            fabricUsed:    { type: "string", enum: fabricEnum },
            expiresAt:     { type: "string", format: "date-time" },
          },
        },
        Problem: {
          type: "object",
          required: ["type", "title", "status"],
          properties: {
            type:     { type: "string", format: "uri" },
            title:    { type: "string" },
            status:   { type: "integer" },
            detail:   { type: "string" },
            instance: { type: "string" },
          },
        },
      },
      responses: {
        Problem: {
          description: "RFC 7807 problem details",
          content: {
            "application/problem+json": {
              schema: { $ref: "#/components/schemas/Problem" },
            },
          },
        },
      },
    },
    "x-rate-limits": RATE_LIMITS,
    "x-api-version": API_VERSION.toString(),
  };
}
