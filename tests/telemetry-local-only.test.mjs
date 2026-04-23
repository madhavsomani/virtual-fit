// Phase 7.12 — guard: telemetry must stay local-only. Previously
// `track()` POSTed to /api/waitlist with a fake `telemetry@<sessionId>`
// email and smuggled events into `revenue`/`killerFeature` fields. That
// abused the endpoint, fingerprinted users without consent, and 404-stormed.
// Hold the line.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEL = resolve(__dirname, "../app/lib/telemetry.ts");

function code() {
  let src = readFileSync(TEL, "utf8");
  // Strip block + line comments so this guard's prose in the file header is fine.
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  src = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return src;
}

test("telemetry.ts contains no network sink (no fetch call)", () => {
  assert.doesNotMatch(code(), /\bfetch\s*\(/);
});

test("telemetry.ts does not call /api/waitlist", () => {
  assert.doesNotMatch(code(), /\/api\/waitlist/);
});

test("telemetry.ts does not exfiltrate fake `telemetry@` emails", () => {
  assert.doesNotMatch(code(), /telemetry@/);
});
