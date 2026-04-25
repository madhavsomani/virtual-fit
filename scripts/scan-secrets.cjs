#!/usr/bin/env node
/**
 * Phase 7.83 — postbuild secret scanner.
 *
 * Scans the static-export output (out/) for any string that matches
 * known secret prefixes. Exits non-zero with a clear error if it finds
 * one — failing the local build BEFORE the operator can `swa deploy`
 * a bundle with a baked-in token.
 *
 * Why this exists: NEXT_PUBLIC_* env vars get inlined into the
 * client-side JS chunks at build time. The HF token in this repo is
 * declared as `process.env.NEXT_PUBLIC_HF_TOKEN`, which means any
 * local build with the token in `.env` ships it to every visitor of
 * the site. CI doesn't pass the token (the workflow has no env: block
 * for it), so production deploys aren't currently leaking — but the
 * design is one local `swa deploy` away from a leak.
 *
 * Patterns scanned:
 *   hf_[A-Za-z0-9]{20,}       — HuggingFace user/org tokens
 *   sk-[A-Za-z0-9]{20,}        — OpenAI / Anthropic-style secret keys
 *   sk_live_[A-Za-z0-9]{20,}   — Stripe live secret key
 *   sk_test_[A-Za-z0-9]{20,}   — Stripe test secret key (still secret)
 *   AKIA[A-Z0-9]{16}           — AWS access key ID
 *   ghp_[A-Za-z0-9]{36}        — GitHub personal access token
 *   ghs_[A-Za-z0-9]{36}        — GitHub server token
 *   xox[abprs]-[A-Za-z0-9-]{20,}  — Slack tokens
 *
 * Also catches the legacy admin-key fallback string from Phase 7.82
 * (vfit-admin-2026) in any client-side chunk — defense-in-depth that
 * the leaked-key string can't accidentally re-appear in the public
 * bundle even if a future agent inlines it from elsewhere.
 *
 * Allowlist: explicit values that are intentionally public (e.g. an
 * HF Space URL, a public anon key for a free-tier service). Add to
 * ALLOWED_STRINGS only after confirming the value is genuinely
 * public. Never allowlist a key that an attacker could use to
 * exfiltrate data, burn quota, or authenticate as you.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.resolve(__dirname, '..', 'out');

// Patterns. Each entry: [name, regex, hint]. The hint tells the
// operator how to remediate.
const PATTERNS = [
  ['HuggingFace token', /hf_[A-Za-z0-9]{20,}/g,
   'Likely a NEXT_PUBLIC_HF_TOKEN inlined client-side. Remove the token from .env before building, or refactor the call site to drop the NEXT_PUBLIC_ prefix and proxy the request through an Azure Function.'],
  ['OpenAI/Anthropic-style secret key', /\bsk-[A-Za-z0-9]{20,}\b/g,
   'API secret key inlined client-side. Move the call to a server-side handler.'],
  ['Stripe live secret key', /\bsk_live_[A-Za-z0-9]{20,}\b/g,
   'STRIPE LIVE SECRET KEY in client bundle. Stop the build and rotate the key in Stripe immediately.'],
  ['Stripe test secret key', /\bsk_test_[A-Za-z0-9]{20,}\b/g,
   'Stripe test secret key in client bundle. Should be rotated and only used server-side.'],
  ['AWS access key ID', /\bAKIA[A-Z0-9]{16}\b/g,
   'AWS access key ID in client bundle. Rotate in IAM immediately.'],
  ['GitHub personal access token', /\bghp_[A-Za-z0-9]{36}\b/g,
   'GitHub PAT in client bundle. Revoke the token at https://github.com/settings/tokens.'],
  ['GitHub server token', /\bghs_[A-Za-z0-9]{36}\b/g,
   'GitHub server token in client bundle. Revoke at the GitHub App settings.'],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{20,}\b/g,
   'Slack token in client bundle. Revoke immediately.'],
  ['Legacy vfit admin-key (Phase 7.82)', /vfit-admin-2026/g,
   'The pre-Phase-7.82 hardcoded admin-key fallback for /api/waitlist-stats. This string must NOT appear in any client-side code or build artifact — it was the public-default backdoor that was removed.'],
];

// Allowlist: literal substrings that, if matched, are intentionally
// public. Currently empty — every match is a real leak.
const ALLOWED_STRINGS = new Set([]);

/** Walk a directory, yielding every regular file path. */
function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/** Returns true if extension is one we should scan (text-like). */
function shouldScan(file) {
  const ext = path.extname(file).toLowerCase();
  return [
    '.js', '.mjs', '.cjs', '.json', '.html', '.htm',
    '.css', '.svg', '.txt', '.map', '.xml', '.webmanifest',
    '',  // extensionless (manifest.json sometimes lands without ext)
  ].includes(ext);
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    // No build output yet. Postbuild scanner is a no-op — main `next
    // build` step would have failed before reaching us.
    console.log(`[scan-secrets] out/ does not exist; nothing to scan.`);
    return 0;
  }

  /** @type {Array<{file:string, pattern:string, match:string, hint:string}>} */
  const findings = [];
  let scannedFiles = 0;

  for (const file of walk(OUT_DIR)) {
    if (!shouldScan(file)) continue;
    scannedFiles++;
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;  // binary or unreadable
    }
    for (const [name, regex, hint] of PATTERNS) {
      // Reset lastIndex because /g regexes are stateful.
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(content)) !== null) {
        const match = m[0];
        if (ALLOWED_STRINGS.has(match)) continue;
        findings.push({
          file: path.relative(OUT_DIR, file),
          pattern: name,
          // Truncate the match in the report so we don't echo a full
          // secret to console output that may end up in CI logs. Show
          // the first 6 chars (enough to identify the prefix) + `...`.
          match: match.length > 8 ? `${match.slice(0, 6)}...` : match,
          hint,
        });
      }
    }
  }

  console.log(`[scan-secrets] scanned ${scannedFiles} file(s) under out/`);

  if (findings.length === 0) {
    console.log(`[scan-secrets] OK — no secret patterns found.`);
    return 0;
  }

  console.error('');
  console.error(`[scan-secrets] FAIL — found ${findings.length} secret pattern match(es) in build output:`);
  console.error('');
  // Group by file for readable output.
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  for (const [file, list] of byFile) {
    console.error(`  ${file}:`);
    for (const item of list) {
      console.error(`    [${item.pattern}] ${item.match}`);
      console.error(`      → ${item.hint}`);
    }
    console.error('');
  }
  console.error('Remediation: delete the offending env var from your local .env (or wherever it is sourced), re-run `npm run build`. The scanner will pass when no secrets appear in the static export.');
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, PATTERNS, ALLOWED_STRINGS };
