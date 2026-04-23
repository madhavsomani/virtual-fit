// Phase 7.13 — guard: `app/lib/generate-3d.ts` was moved to root `lib/`
// because it's a server-only module consumed only by `api-server.ts` (a
// dev tool). Living under `app/` risked future client components
// accidentally importing it and shipping `Buffer`/`fetch`-of-data-URI code
// to the browser. Stay moved.

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

test("generate-3d.ts lives at root lib/, not app/lib/", () => {
  assert.ok(
    !existsSync(resolve(ROOT, "app/lib/generate-3d.ts")),
    "Phase 7.13 moved generate-3d.ts out of app/lib/ \u2014 do not put it back. " +
      "If a Next page genuinely needs server-side TripoSR, expose it via a Next " +
      "Route Handler under app/api/ that imports from root lib/.",
  );
  assert.ok(
    existsSync(resolve(ROOT, "lib/generate-3d.ts")),
    "lib/generate-3d.ts is missing \u2014 the dev api-server.ts depends on it.",
  );
});

test("api-server.ts imports generate-3d from root lib/, not app/lib/", () => {
  const src = readFileSync(resolve(ROOT, "api-server.ts"), "utf8");
  assert.match(src, /from\s+['"]\.\/lib\/generate-3d(\.js)?['"]/);
  assert.doesNotMatch(src, /from\s+['"]\.\/app\/lib\/generate-3d/);
});
