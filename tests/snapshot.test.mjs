import { test } from "node:test";
import assert from "node:assert/strict";

import { snapshotFilename } from "../lib/snapshot.ts";

test("snapshotFilename uses YYYYMMDD-HHMMSS pattern with leading zeros", () => {
  const fixed = new Date(2026, 0, 5, 7, 8, 9); // Jan 5, 2026 07:08:09 local
  assert.equal(snapshotFilename(fixed), "virtualfit-20260105-070809.png");
});

test("snapshotFilename has .png extension and virtualfit prefix", () => {
  const name = snapshotFilename(new Date(2026, 11, 31, 23, 59, 59));
  assert.match(name, /^virtualfit-\d{8}-\d{6}\.png$/);
});

test("two snapshots in different seconds get different names", () => {
  const a = snapshotFilename(new Date(2026, 5, 1, 12, 0, 0));
  const b = snapshotFilename(new Date(2026, 5, 1, 12, 0, 1));
  assert.notEqual(a, b);
});
