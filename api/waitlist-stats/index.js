const fs = require('fs');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

/**
 * GET /api/waitlist-stats?key=<admin-key>
 * Returns waitlist signup stats from the JSONL log file.
 */
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors };
    return;
  }

  // Simple auth
  const key = req.query.key;
  const adminKey = process.env.ADMIN_KEY || 'vfit-admin-2026';
  if (key !== adminKey) {
    context.res = { status: 401, headers: cors, body: { error: 'Invalid key. Use ?key=<admin-key>' } };
    return;
  }

  try {
    // Read the JSONL log written by the waitlist function
    const logPath = '/tmp/virtualfit-waitlist.jsonl';
    let entries = [];
    
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
      entries = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }

    // Filter out telemetry events (source=telemetry)
    const signups = entries.filter(e => e.source !== 'telemetry' && e.source !== 'embed-widget');

    // Stats
    const now = new Date();
    const last24h = signups.filter(e => {
      const ts = new Date(e.timestamp);
      return (now - ts) < 24 * 60 * 60 * 1000;
    });

    const last7d = signups.filter(e => {
      const ts = new Date(e.timestamp);
      return (now - ts) < 7 * 24 * 60 * 60 * 1000;
    });

    // WTP breakdown
    const wtpBreakdown = {};
    signups.forEach(e => {
      if (e.wouldPay) {
        wtpBreakdown[e.wouldPay] = (wtpBreakdown[e.wouldPay] || 0) + 1;
      }
    });

    // Revenue breakdown
    const revenueBreakdown = {};
    signups.forEach(e => {
      if (e.revenue) {
        revenueBreakdown[e.revenue] = (revenueBreakdown[e.revenue] || 0) + 1;
      }
    });

    context.res = {
      status: 200,
      headers: cors,
      body: {
        total: signups.length,
        last24h: last24h.length,
        last7d: last7d.length,
        lastSignup: signups.length > 0 ? signups[signups.length - 1].timestamp : null,
        recentSignups: signups.slice(-10).reverse().map(e => ({
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
    context.res = {
      status: 500,
      headers: cors,
      body: { error: 'Failed to read stats', detail: err.message },
    };
  }
};
