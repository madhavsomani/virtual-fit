import assert from "node:assert/strict";
import test from "node:test";

import { trellisAdapter } from "../lib/garment-pipeline-trellis-adapter.ts";

test("trellisAdapter stays blocked pending approval", async () => {
  await assert.rejects(
    trellisAdapter.generate({
      garmentId: "core-crew-tee",
      sourceImageUrl: "/tmp/source.png",
      outputAbsPath: "/tmp/core-crew-tee.glb"
    }),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.match(error.message, /approval pending/i);
      return true;
    }
  );
});
