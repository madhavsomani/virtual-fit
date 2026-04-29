import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const scriptPath = resolve(repoRoot, "scripts", "generate-garment-mesh.mjs");

test("CLI writes a succeeded manifest entry and placeholder mesh", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-cli-success-"));

  mkdirSync(join(rootDir, "data"), { recursive: true });
  mkdirSync(join(rootDir, "public", "garments"), { recursive: true });
  writeFileSync(join(rootDir, "data", "garment-pipeline-jobs.json"), "[]\n", "utf8");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--garment", "core-crew-tee", "--image", "https://example.com/core-crew-tee.png"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        VF9_ROOT_DIR: rootDir
      },
      encoding: "utf8"
    }
  );

  try {
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[VF-9\] generated stub mesh for core-crew-tee/);

    const manifest = JSON.parse(readFileSync(join(rootDir, "data", "garment-pipeline-jobs.json"), "utf8"));
    const outputPath = join(rootDir, "public", "garments", "core-crew-tee.glb");

    assert.equal(manifest.length, 1);
    assert.equal(manifest[0].garmentId, "core-crew-tee");
    assert.equal(manifest[0].status, "succeeded");
    assert.equal(manifest[0].outputAssetUrl, "/garments/core-crew-tee.glb");
    assert.equal(readFileSync(outputPath).length, 12);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("CLI rejects unknown garment ids without mutating the manifest", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-cli-fail-"));

  mkdirSync(join(rootDir, "data"), { recursive: true });
  mkdirSync(join(rootDir, "public", "garments"), { recursive: true });
  writeFileSync(join(rootDir, "data", "garment-pipeline-jobs.json"), "[]\n", "utf8");

  const result = spawnSync(process.execPath, [scriptPath, "--garment", "unknown-id", "--image", "/tmp/source.png"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      VF9_ROOT_DIR: rootDir
    },
    encoding: "utf8"
  });

  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown garmentId/i);
    const manifest = JSON.parse(readFileSync(join(rootDir, "data", "garment-pipeline-jobs.json"), "utf8"));
    assert.deepEqual(manifest, []);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
