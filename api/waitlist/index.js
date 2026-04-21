// Azure SWA Function: Waitlist signup handler
// Data is logged to Application Insights and sent via FormSubmit email
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

    const entry = {
      email: body.email,
      revenue: body.revenue || '',
      wouldPay: body.wouldPay || '',
      killerFeature: body.killerFeature || '',
      timestamp: new Date().toISOString(),
      source: body.source || 'website',
      userAgent: req.headers['user-agent'] || '',
    };

    // Log entry (Azure SWA functions are stateless - no /tmp persistence)
    // Data is logged to Application Insights via context.log and sent via email
    context.log.info(`WAITLIST_ENTRY: ${JSON.stringify(entry)}`);

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
  } catch (err) {
    context.log.error('Waitlist error:', err);
    context.res = {
      status: 500,
      headers: cors,
      body: { error: 'Something went wrong. Please try again.' },
    };
  }
};
