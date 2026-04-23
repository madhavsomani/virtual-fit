// Phase 7.11 — guard: `app/lib/generate-3d-client.ts` was dead code
// that retained Meshy-flavored polling. Stay deleted; if it ever returns
// it must NOT bring back paid-API references (already covered by
// no-paid-apis.test.mjs, which would catch its `MAX_POLLS`/Meshy comments).

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("dead `generate-3d-client.ts` stays deleted (no zero-importer modules)", () => {
  const dead = resolve(__dirname, "../app/lib/generate-3d-client.ts");
  assert.ok(
    !existsSync(dead),
    "app/lib/generate-3d-client.ts was removed in Phase 7.11 — do not resurrect (it had zero importers and Meshy polling logic).",
  );
});
