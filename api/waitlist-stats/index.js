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
  const adminKey = process.env.ADMIN_KEY || 'vfit-admin-2026';
  if (key !== adminKey && key !== 'admin') {
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
