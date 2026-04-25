const fs = require('fs');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

/**
 * GET /api/waitlist-stats?key=<admin-key>
 * Returns real waitlist signup stats from the JSONL log file.
 * Separates real signups from test entries.
 */
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors };
    return;
  }

  // Phase 7.63: PUBLIC, no-auth path — returns ONLY the retailer count
  // for the /retailer/signup social-proof number. Pre-7.63 this endpoint
  // gated EVERYTHING behind adminKey, so the signup page (which calls
  // without a key) always got 401 and the count never displayed. The
  // PII fields (email/wouldPay/breakdowns/recentSignups) stay admin-only
  // — only the aggregate retailer count is exposed publicly.
  const key = req.query.key;
  if (!key) {
    try {
      const logPath = '/tmp/virtualfit-waitlist.jsonl';
      let retailers = 0;
      if (fs.existsSync(logPath)) {
        const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const e = JSON.parse(line);
            if (e && !e.isTest && e.source === 'retailer-signup') retailers++;
          } catch { /* skip malformed */ }
        }
      }
      context.res = { status: 200, headers: cors, body: { retailers } };
      return;
    } catch (err) {
      context.res = { status: 200, headers: cors, body: { retailers: 0 } };
      return;
    }
  }

  // Simple auth (admin path)
  // Phase 7.82: PII leak fix.
  // Pre-7.82 admin auth had two critical leaks:
  //   (1) `process.env.ADMIN_KEY || 'vfit-admin-2026'` — if the env var
  //       is unset (e.g. fresh Azure SWA deploy where the secret was
  //       never wired), the literal 'vfit-admin-2026' became a valid
  //       key. The fallback string is in this open-source repo.
  //   (2) `if (key !== adminKey && key !== 'admin')` — the literal
  //       string 'admin' was a hardcoded backdoor. Anyone visiting
  //       /api/waitlist-stats?key=admin received full PII for EVERY
  //       real waitlist signup: email, revenue intent, killer-feature
  //       answer, exact UTC timestamp, the last 10 emails verbatim.
  // Both gates are removed. If ADMIN_KEY is unset we now hard-fail
  // with 503 (misconfigured) instead of silently accepting the
  // hardcoded fallback. The compare is timing-safe via crypto to
  // avoid trivial brute-force timing attacks on a short shared key.
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    context.log.error('waitlist-stats: ADMIN_KEY env var is not configured — admin path disabled.');
    context.res = {
      status: 503,
      headers: cors,
      body: { error: 'Admin endpoint is not configured.' },
    };
    return;
  }
  // Timing-safe equality. crypto.timingSafeEqual requires equal-length
  // buffers, so we wrap with a length check first — mismatched length
  // is the common case (random query-string guesses) and short-circuits
  // before we allocate buffers.
  let authorized = false;
  try {
    const provided = Buffer.from(String(key), 'utf8');
    const expected = Buffer.from(adminKey, 'utf8');
    if (provided.length === expected.length) {
      const crypto = require('crypto');
      authorized = crypto.timingSafeEqual(provided, expected);
    }
  } catch { /* fall through to 401 */ }
  if (!authorized) {
    context.res = { status: 401, headers: cors, body: { error: 'Invalid key' } };
    return;
  }

  try {
    const logPath = '/tmp/virtualfit-waitlist.jsonl';
    let entries = [];
    
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
      entries = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }

    // Split real vs test
    const realSignups = entries.filter(e => !e.isTest && e.source !== 'telemetry' && e.source !== 'embed-widget');
    const testSignups = entries.filter(e => e.isTest || e.source === 'telemetry' || e.source === 'embed-widget');

    const now = new Date();
    const last24h = realSignups.filter(e => (now - new Date(e.timestamp)) < 86400000);
    const last7d = realSignups.filter(e => (now - new Date(e.timestamp)) < 604800000);

    // WTP breakdown (real only)
    const wtpBreakdown = {};
    realSignups.forEach(e => {
      if (e.wouldPay) wtpBreakdown[e.wouldPay] = (wtpBreakdown[e.wouldPay] || 0) + 1;
    });

    const revenueBreakdown = {};
    realSignups.forEach(e => {
      if (e.revenue) revenueBreakdown[e.revenue] = (revenueBreakdown[e.revenue] || 0) + 1;
    });

    context.res = {
      status: 200,
      headers: cors,
      body: {
        count: realSignups.length,
        testCount: testSignups.length,
        last24h: last24h.length,
        last7d: last7d.length,
        lastSignup: realSignups.length > 0 ? realSignups[realSignups.length - 1].timestamp : null,
        recentSignups: realSignups.slice(-10).reverse().map(e => ({
          email: e.email,
          revenue: e.revenue || '',
          wouldPay: e.wouldPay || '',
          killerFeature: e.killerFeature || '',
          source: e.source || '',
          timestamp: e.timestamp,
        })),
        wtpBreakdown,
        revenueBreakdown,
      },
    };
  } catch (err) {
    context.log.error('waitlist-stats error:', err);
    context.res = { status: 200, headers: cors, body: { count: 0, testCount: 0, error: err.message } };
  }
};
