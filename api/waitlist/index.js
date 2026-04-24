// Azure SWA Function: Waitlist signup handler
// Data is logged to Application Insights, appended to a JSONL file for the
// stats endpoint, and emailed via FormSubmit.
//
// Phase 7.40: added the missing `fs` require + `logPath` constant + the
// `fs.appendFileSync(logPath, ...)` call. Pre-7.40 the milestone webhook
// block referenced `fs.readFileSync(logPath, ...)` with neither symbol
// defined, so every real signup hit a ReferenceError swallowed by the
// inner warn — the milestone webhook had never fired in production.
// Worse, `api/waitlist-stats` reads the same `logPath` to compute count
// / recentSignups / wtpBreakdown / revenueBreakdown, but no one was ever
// appending — so the "live retailer count" was permanently 0.
const fs = require('fs');

const logPath = '/tmp/virtualfit-waitlist.jsonl';

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };
    return;
  }

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const body = req.body;
    if (!body || !body.email) {
      context.res = { status: 400, headers: cors, body: { error: 'Email is required' } };
      return;
    }

    const isTest = body.isTest === true || body.source === 'e2e-test' || body.source === 'telemetry';

    const entry = {
      email: body.email,
      revenue: body.revenue || '',
      wouldPay: body.wouldPay || '',
      killerFeature: body.killerFeature || '',
      timestamp: new Date().toISOString(),
      source: body.source || 'website',
      userAgent: req.headers['user-agent'] || '',
      isTest: isTest,
      referer: req.headers['referer'] || req.headers['referrer'] || '',
      utm: body.utm || '',
    };

    // Log entry — differentiate test vs real
    const logTag = isTest ? 'WAITLIST_TEST_ENTRY' : 'WAITLIST_ENTRY';
    context.log.info(`${logTag}: ${JSON.stringify(entry)}`);

    // Phase 7.40: persist to JSONL so /api/waitlist-stats can compute real
    // counts AND so the milestone webhook below has a file to count from.
    // Pre-7.40 nobody wrote here, so stats said `count: 0` forever and the
    // milestone block crashed on `fs is not defined`. We append BOTH real
    // and test entries (the `isTest` field is preserved so the stats
    // endpoint and milestone block can filter test traffic out).
    // Defensive: if /tmp is unwritable we still ship the 200 response.
    try {
      fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
    } catch (writeErr) {
      context.log.warn('Waitlist JSONL append failed:', writeErr.message);
    }

    // Send email notification via fetch to a simple email service
    // Using a free service like formsubmit.co or just logging for now
    const emailTo = 'madhavsomani007@gmail.com';
    
    // Try sending via FormSubmit (free, no signup needed)
    try {
      await fetch(`https://formsubmit.co/ajax/${emailTo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `🎯 VirtualFit Waitlist: ${entry.email}`,
          email: entry.email,
          revenue: entry.revenue,
          would_pay_49: entry.wouldPay,
          killer_feature: entry.killerFeature,
          timestamp: entry.timestamp,
          source: entry.source,
        }),
      });
    } catch (emailErr) {
      // Email send failed — not critical, data is logged
      context.log.warn('Email notification failed:', emailErr.message);
    }

    context.res = {
      status: 200,
      headers: cors,
      body: {
        success: true,
        message: "You're on the list! We'll reach out soon.",
      },
    };

    context.log.info(`Waitlist signup: ${entry.email} | Revenue: ${entry.revenue} | Would pay: ${entry.wouldPay}`);

    // Milestone webhook — only count real signups, skip test entries
    const webhookUrl = process.env.MILESTONE_WEBHOOK_URL;
    if (webhookUrl && !isTest) {
      try {
        const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
        const count = lines.filter(l => {
          try { const e = JSON.parse(l); return !e.isTest && e.source !== 'telemetry'; } catch { return false; }
        }).length;
        const milestones = [5, 10, 25, 50, 100, 250, 500, 1000];
        const milestone = milestones.includes(count) ? count : null;
        if (milestone) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `\ud83c\udf89 VirtualFit milestone: ${milestone} waitlist signups! Latest: ${entry.email}`,
              count,
              email: entry.email,
              milestone,
            }),
          });
          context.log.info(`Milestone webhook fired: ${milestone} signups`);
        }
      } catch (whErr) {
        context.log.warn('Milestone webhook failed:', whErr.message);
      }
    }
  } catch (err) {
    context.log.error('Waitlist error:', err);
    context.res = {
      status: 500,
      headers: cors,
      body: { error: 'Something went wrong. Please try again.' },
    };
  }
};
