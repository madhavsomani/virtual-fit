// Phase 7.83 — guard: postbuild secret scanner.
//
// scripts/scan-secrets.cjs is wired into the CI Deploy workflow
// between `pnpm run build` and the Azure SWA deploy step. Its job is
// to fail the deploy if any secret pattern (hf_/sk_/AKIA/ghp_/Stripe
// secret/legacy admin-key) appears in the static-export bundle.
//
// This test exercises the scanner against synthetic /tmp directories
// containing both clean output and seeded-leak output, and asserts:
//   - clean output → exit 0
//   - HF token in JS chunk → exit 1 + finding for HuggingFace
//   - Stripe live secret in any file → exit 1
//   - legacy 'vfit-admin-2026' string in any file → exit 1
//   - extensionless / binary files don't crash the walker
//   - missing out/ → exit 0 (no-op when nothing to scan)
//
// Implementation note: scan-secrets.cjs hardcodes OUT_DIR relative to
// __dirname. We can't repoint it from a test, so we exercise it
// end-to-end via child_process.spawnSync against a temp tree by
// (a) loading the module to test pattern detection in isolation, and
// (b) running the script with a custom CWD layout that mirrors the
// real out/ structure.

import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const SCANNER = resolve(__dirname, "..", "scripts", "scan-secrets.cjs");

test("scanner module exports PATTERNS and ALLOWED_STRINGS", () => {
  const mod = require(SCANNER);
  assert.ok(Array.isArray(mod.PATTERNS), "exports PATTERNS array");
  assert.ok(mod.PATTERNS.length >= 8, "must scan for at least 8 patterns");
  assert.ok(mod.ALLOWED_STRINGS instanceof Set, "exports ALLOWED_STRINGS Set");
  // ALLOWED_STRINGS must be empty by default — every allowlist entry
  // is a deliberate decision that needs human review. A pre-populated
  // allowlist would silently let any of those strings through.
  assert.equal(
    mod.ALLOWED_STRINGS.size,
    0,
    "ALLOWED_STRINGS must start empty so allowlisting is always a deliberate, reviewable change",
  );
});

test("PATTERNS catch known leak shapes", () => {
  const { PATTERNS } = require(SCANNER);
  // Build synthetic-secret strings via runtime concatenation so the
  // literals NEVER appear in source. GitHub Push Protection (and
  // similar secret scanners) match the same shapes we're testing for
  // — if we wrote them inline they'd block this very file.
  const HF = "hf_" + "QBwxldbofvIkEwFp" + "xqqdvHvZPPCxrTbgPf";
  const SK_PROJ = "sk-" + "projABC123def456" + "ghi789jkl012mno345pqr";
  const SK_LIVE = "sk_live_" + "FAKEabcdefghij" + "klmnopqrstuvwxyz";
  const SK_TEST = "sk_test_" + "FAKEabcdefghij" + "klmnopqrstuvwxyz";
  const AKIA = "AKIA" + "IOSFOD" + "NN7EXAMPLE";
  const GHP = "ghp_" + "aBcDeFgHiJkLmNoP" + "qRsTuVwXyZ1234567890";
  const GHS = "ghs_" + "aBcDeFgHiJkLmNoP" + "qRsTuVwXyZ1234567890";
  const SLACK = "xoxb" + "-123456789-" + "abcdefghij1234567890";
  const VFIT = ["vfit", "admin", "2026"].join("-");

  const haystackPositive = [HF, SK_PROJ, SK_LIVE, SK_TEST, AKIA, GHP, GHS, SLACK, VFIT].join(" ");

  let totalMatches = 0;
  for (const [name, regex] of PATTERNS) {
    regex.lastIndex = 0;
    const m = haystackPositive.match(regex) || [];
    assert.ok(m.length > 0, `pattern '${name}' must match its known shape in haystack`);
    totalMatches += m.length;
  }
  assert.ok(totalMatches >= 9, `expected >=9 total matches across patterns, got ${totalMatches}`);
});

test("PATTERNS do not false-positive on innocent strings", () => {
  const { PATTERNS } = require(SCANNER);
  const innocent = [
    "this string mentions HuggingFace but contains no token",
    "function sk(name) { return name; } // not a key",
    "AKIAtoolow", // too short to match AKIA pattern
    "https://api-inference.huggingface.co/models/briaai/RMBG-1.4",
    "<svg viewBox=\"0 0 16 16\">...</svg>",
  ].join("\n");

  for (const [name, regex] of PATTERNS) {
    regex.lastIndex = 0;
    const m = innocent.match(regex);
    assert.equal(
      m,
      null,
      `pattern '${name}' must NOT false-positive on innocent text; matched: ${m}`,
    );
  }
});

// --- End-to-end scanner runs against synthetic out/ ---
// scan-secrets.cjs hardcodes OUT_DIR = ../out relative to itself, so
// we can't redirect it from a test arg. Instead we point at a SYMLINK:
// create a temp dir tree, then symlink ../out → temp/out before
// spawning the script.

function withTempOut(seedFn, runFn) {
  const realOutPath = resolve(__dirname, "..", "out");
  const tempRoot = mkdtempSync(join(tmpdir(), "vfit-scan-"));
  const tempOut = join(tempRoot, "out");
  mkdirSync(tempOut, { recursive: true });

  // Save the real out/ (if any) by renaming it. The scanner's
  // hardcoded OUT_DIR points at app/out, which is ALSO the real build
  // output we don't want to touch. Move it aside, point at our
  // synthetic, restore on cleanup.
  const stashed = existsSync(realOutPath) ? `${realOutPath}.scan-stash-${Date.now()}` : null;
  if (stashed) {
    require("node:fs").renameSync(realOutPath, stashed);
  }
  // Symlink real OUT_DIR → tempOut. (rename + symlink so the scanner's
  // resolved path lands inside our synthetic tree.)
  require("node:fs").symlinkSync(tempOut, realOutPath, "dir");

  try {
    seedFn(tempOut);
    const result = spawnSync("node", [SCANNER], { encoding: "utf8" });
    runFn(result);
  } finally {
    require("node:fs").unlinkSync(realOutPath);
    if (stashed) {
      require("node:fs").renameSync(stashed, realOutPath);
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("scanner exits 0 on clean output", () => {
  withTempOut(
    (out) => {
      mkdirSync(join(out, "_next", "static", "chunks"), { recursive: true });
      writeFileSync(
        join(out, "_next", "static", "chunks", "main.js"),
        "console.log('hello'); var safe = 'no secrets here';",
      );
      writeFileSync(join(out, "index.html"), "<html><body>hi</body></html>");
    },
    (result) => {
      assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
      assert.match(result.stdout, /no secret patterns found/);
    },
  );
});

test("scanner exits 1 + reports HuggingFace finding when token leaks", () => {
  const FAKE_HF = "hf_" + "FAKEbutValidShape" + "ABCDEFGHIJKLMN";
  withTempOut(
    (out) => {
      mkdirSync(join(out, "_next", "static", "chunks"), { recursive: true });
      writeFileSync(
        join(out, "_next", "static", "chunks", "main.js"),
        "var t = '" + FAKE_HF + "'; fetch('/x', {headers:{Authorization:'Bearer '+t}})",
      );
    },
    (result) => {
      assert.equal(result.status, 1, "must exit non-zero on leak");
      assert.match(result.stderr, /HuggingFace token/);
      // Must redact in output (only show prefix, not full token).
      assert.match(result.stderr, /hf_FAK\.\.\./);
      // Must NOT echo the full token (that would leak it into CI logs).
      assert.equal(
        result.stderr.includes("FAKEbutValidShape" + "ABCDEFGHIJKLMN"),
        false,
        "scanner must NOT echo the full secret to stderr (would leak into CI logs)",
      );
    },
  );
});

test("scanner exits 1 on Stripe live secret in any file", () => {
  const FAKE_STRIPE = "sk_live_" + "FAKEabcdefghij" + "klmnopqrstuvwxyz";
  withTempOut(
    (out) => {
      writeFileSync(
        join(out, "data.json"),
        '{"key":"' + FAKE_STRIPE + '"}',
      );
    },
    (result) => {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Stripe live secret key/);
    },
  );
});

test("scanner exits 1 on legacy 'vfit-admin-2026' in client bundle", () => {
  const LEGACY = ["vfit", "admin", "2026"].join("-");
  withTempOut(
    (out) => {
      mkdirSync(join(out, "_next", "static", "chunks"), { recursive: true });
      writeFileSync(
        join(out, "_next", "static", "chunks", "page.js"),
        "var key = '" + LEGACY + "';",
      );
    },
    (result) => {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Legacy vfit admin-key/);
    },
  );
});

test("scanner does not crash on binary / extensionless files", () => {
  withTempOut(
    (out) => {
      // Extensionless file (e.g. legacy manifest).
      writeFileSync(join(out, "manifest"), '{"name":"clean"}');
      // Fake binary (random-ish bytes that include high-bit chars).
      writeFileSync(
        join(out, "favicon.ico"),
        Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x80, 0x81]),
      );
    },
    (result) => {
      assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    },
  );
});

test("scanner exits 0 (no-op) when out/ does not exist", () => {
  // Special case: real OUT_DIR is a symlink target that we delete first.
  const realOutPath = resolve(__dirname, "..", "out");
  const stashed = existsSync(realOutPath) ? `${realOutPath}.scan-stash-${Date.now()}` : null;
  if (stashed) require("node:fs").renameSync(realOutPath, stashed);
  try {
    const result = spawnSync("node", [SCANNER], { encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /does not exist/);
  } finally {
    if (stashed) require("node:fs").renameSync(stashed, realOutPath);
  }
});

test("CI workflow runs scan:secrets between Build and Deploy", () => {
  const wf = require("node:fs").readFileSync(
    resolve(__dirname, "..", "..", ".github", "workflows", "deploy.yml"),
    "utf8",
  );
  // Order matters: scan must be AFTER build (otherwise out/ doesn't
  // exist) and BEFORE deploy (otherwise the leak ships first).
  const buildIdx = wf.indexOf("pnpm run build");
  const scanIdx = wf.indexOf("scan:secrets");
  const deployIdx = wf.indexOf("Deploy to Azure SWA");
  assert.ok(buildIdx > 0, "workflow must run pnpm run build");
  assert.ok(scanIdx > 0, "workflow must run scan:secrets");
  assert.ok(deployIdx > 0, "workflow must have a Deploy step");
  assert.ok(
    buildIdx < scanIdx,
    "scan:secrets must run AFTER build (otherwise out/ doesn't exist yet)",
  );
  assert.ok(
    scanIdx < deployIdx,
    "scan:secrets must run BEFORE deploy (otherwise the leak ships first)",
  );
});
