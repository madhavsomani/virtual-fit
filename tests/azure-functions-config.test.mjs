// Phase 7.50 — guard: api/host.json + api/package.json exist and pin the
// Azure Functions runtime contract that staticwebapp.config.json's
// apiRuntime:node:20 + the SWA workflow's api_location:"api" implicitly
// require.
//
// Pre-7.50 neither file existed. Without host.json, the Functions runtime
// version isn't pinned and bindings beyond plain HTTP have no extension
// bundle to bind against. Without package.json, Azure can't `npm install`
// inside api/, the Node engine isn't pinned, and depending on the runner
// either no node_modules ship or the parent's huge tree gets copied.
// Same trust-the-deploy class as Phase 7.45 (canonical npm test gating CI).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const API = resolve(ROOT, "api");
const HOST = resolve(API, "host.json");
const PKG = resolve(API, "package.json");

test("api/host.json exists, parses, and declares Functions runtime version 2.0", () => {
  assert.ok(existsSync(HOST), "api/host.json is required by Azure Functions runtime.");
  const h = JSON.parse(readFileSync(HOST, "utf8"));
  assert.equal(
    h.version,
    "2.0",
    `api/host.json must declare "version": "2.0" (got ${JSON.stringify(h.version)})`,
  );
});

test("api/host.json declares the Microsoft Azure Functions extension bundle", () => {
  const h = JSON.parse(readFileSync(HOST, "utf8"));
  assert.ok(h.extensionBundle, "api/host.json must declare extensionBundle");
  assert.equal(
    h.extensionBundle.id,
    "Microsoft.Azure.Functions.ExtensionBundle",
    `extensionBundle.id must be Microsoft.Azure.Functions.ExtensionBundle (got ${h.extensionBundle.id})`,
  );
  assert.ok(
    typeof h.extensionBundle.version === "string" && h.extensionBundle.version.length > 0,
    "extensionBundle.version must be a non-empty version range",
  );
});

test("api/package.json exists, parses, and pins engines.node >=20", () => {
  assert.ok(existsSync(PKG), "api/package.json is required so Azure SWA can install + version the function app.");
  const p = JSON.parse(readFileSync(PKG, "utf8"));
  assert.ok(typeof p.name === "string" && p.name.length > 0, "api/package.json missing name");
  assert.ok(p.engines && typeof p.engines.node === "string", "api/package.json must declare engines.node");
  // staticwebapp.config.json declares apiRuntime: node:20, so engines.node
  // must permit node 20.
  assert.match(
    p.engines.node,
    /(?:>=20|\^20|~20|20\.x|20\b)/,
    `api/package.json engines.node (${p.engines.node}) must permit Node 20 to match staticwebapp.config.json's apiRuntime: node:20`,
  );
});

test("api/package.json has no runtime dependencies (deploy stays lean)", () => {
  const p = JSON.parse(readFileSync(PKG, "utf8"));
  // The waitlist + waitlist-stats functions only use built-ins (fs, fetch).
  // If we ever add a real dep, intentionally update this guard along with
  // the addition.
  const deps = Object.keys(p.dependencies || {});
  assert.deepEqual(
    deps,
    [],
    `api/package.json should have no runtime deps (current functions use built-ins only). Found: ${deps.join(", ")}. If a dep is intentional, update this guard.`,
  );
});

test("every api/<func>/index.js has a sibling function.json (no half-added functions)", () => {
  for (const entry of readdirSync(API)) {
    const dir = join(API, entry);
    let s;
    try { s = statSync(dir); } catch { continue; }
    if (!s.isDirectory()) continue;
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const idx = join(dir, "index.js");
    const fn = join(dir, "function.json");
    if (existsSync(idx)) {
      assert.ok(
        existsSync(fn),
        `api/${entry}/ has index.js but is missing function.json — Azure Functions will not register the trigger.`,
      );
    }
  }
});
