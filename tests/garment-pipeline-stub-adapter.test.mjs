import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { stubAdapter } from "../lib/garment-pipeline-stub-adapter.mjs";

test("stubAdapter writes a 12-byte placeholder glTF header", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-stub-adapter-"));
  const outputAbsPath = join(rootDir, "public", "garments", "core-crew-tee.glb");

  const result = await stubAdapter.generate({
    garmentId: "core-crew-tee",
    sourceImageUrl: "/tmp/source.png",
    outputAbsPath
  });

  const buffer = readFileSync(outputAbsPath);

  assert.equal(buffer.length, 12);
  assert.equal(buffer[0], 0x67);
  assert.equal(buffer[1], 0x6c);
  assert.equal(buffer[2], 0x54);
  assert.equal(buffer[3], 0x46);
  assert.equal(result.outputAssetUrl, "/garments/core-crew-tee.glb");
});
