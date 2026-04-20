"use client";
import { useState } from "react";

function generateShopId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
}

export default function RetailerSignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState("");
  const [form, setForm] = useState({
    shopName: "",
    shopUrl: "",
    contactEmail: "",
    productCount: "",
    platform: "",
  });

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shopName || !form.contactEmail) return;

    setLoading(true);
    const id = generateShopId(form.shopName);
    setShopId(id);

    // Submit to waitlist API (reuse existing endpoint)
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.contactEmail,
          revenue: form.platform + ' | ' + form.productCount + ' products',
          wouldPay: 'retailer-signup',
          killerFeature: 'Shop: ' + form.shopUrl + ' | Platform: ' + form.platform,
          source: 'retailer-signup',
        }),
      });
    } catch {
      // Non-blocking — still show success
    }

    // Save locally
    try {
      const shops = JSON.parse(localStorage.getItem('virtualfit-shops') || '[]');
      shops.push({ ...form, shopId: id, createdAt: new Date().toISOString() });
      localStorage.setItem('virtualfit-shops', JSON.stringify(shops));
    } catch {}

    setLoading(false);
    setStep(2);
  };

  const embedOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://wonderful-sky-0513a3610.7.azurestaticapps.net';
  const embedSnippet = `<script
  src="${embedOrigin}/embed.js"
  data-shop-id="${shopId}"
  data-retailer="${form.shopName}"
  data-position="bottom-right"
  data-color="#6C5CE7">
<\/script>`;

  const iframeSnippet = `<iframe
  src="${embedOrigin}/mirror/?embed=true&shopId=${encodeURIComponent(shopId)}&retailer=${encodeURIComponent(form.shopName)}"
  width="100%" height="600"
  frameborder="0" allow="camera"
/>`;

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0c0c0e",
      color: "#e4e4e7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 24,
    }}>
      <div style={{ maxWidth: 560, width: "100%", marginTop: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🏪</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 4px" }}>Add Virtual Try-On to Your Store</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>
            Free setup • 5-minute install • No code changes needed
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleSubmit} style={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 16,
            padding: "32px 28px",
          }}>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Store Name *</label>
              <input
                type="text"
                value={form.shopName}
                onChange={e => update('shopName', e.target.value)}
                placeholder="e.g. Urban Thread Co"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Store URL</label>
              <input
                type="url"
                value={form.shopUrl}
                onChange={e => update('shopUrl', e.target.value)}
                placeholder="https://yourstore.com"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Contact Email *</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={e => update('contactEmail', e.target.value)}
                placeholder="you@yourstore.com"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>How many products do you sell?</label>
              <select
                value={form.productCount}
                onChange={e => update('productCount', e.target.value)}
                style={inputStyle}
              >
                <option value="">Select...</option>
                <option value="1-10">1–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="200+">200+</option>
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Platform</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Shopify", "WooCommerce", "Squarespace", "Custom / Other"].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update('platform', p)}
                    style={{
                      padding: "8px 16px", fontSize: 13, borderRadius: 8,
                      border: form.platform === p ? "2px solid #6C5CE7" : "1px solid #27272a",
                      background: form.platform === p ? "rgba(108,92,231,0.2)" : "#09090b",
                      color: form.platform === p ? "#a29bfe" : "#a1a1aa",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: 14, fontSize: 16, fontWeight: 700,
                background: "#6C5CE7", color: "#fff", border: "none",
                borderRadius: 10, cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Setting up..." : "Get Your Embed Code →"}
            </button>

            <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#52525b" }}>
              Free during beta • No credit card required
            </p>
          </form>
        )}

        {step === 2 && (
          <div>
            <div style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 24,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>You&apos;re set up!</div>
              <div style={{ fontSize: 13, color: "#71717a", marginTop: 4 }}>
                Shop ID: <code style={{ background: "#27272a", padding: "2px 6px", borderRadius: 4 }}>{shopId}</code>
              </div>
            </div>

            {/* Step 1: Script embed */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
                Step 1: Add to your site
              </h3>
              <p style={{ color: "#71717a", fontSize: 13, marginBottom: 12 }}>
                Paste this before the closing <code>&lt;/body&gt;</code> tag:
              </p>
              <pre style={codeStyle}>{embedSnippet}</pre>
              <button
                onClick={() => navigator.clipboard?.writeText(embedSnippet.replace('<\\/script>', '</script>'))}
                style={copyBtnStyle}
              >
                📋 Copy Script Tag
              </button>
            </div>

            {/* Step 2: iframe alternative */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
                Alternative: iframe embed
              </h3>
              <pre style={codeStyle}>{iframeSnippet}</pre>
              <button
                onClick={() => navigator.clipboard?.writeText(iframeSnippet)}
                style={copyBtnStyle}
              >
                📋 Copy iframe
              </button>
            </div>

            {/* Test it */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
                Step 2: Test it
              </h3>
              <p style={{ color: "#71717a", fontSize: 13, marginBottom: 12 }}>
                See the try-on experience your customers will get:
              </p>
              <a
                href={`/mirror/?embed=true&shopId=${encodeURIComponent(shopId)}&retailer=${encodeURIComponent(form.shopName)}`}
                target="_blank"
                rel="noopener"
                style={{
                  display: "inline-block", padding: "10px 20px", fontSize: 14, fontWeight: 600,
                  background: "#6C5CE7", color: "#fff", borderRadius: 8, textDecoration: "none",
                }}
              >
                🪞 Open Try-On Preview
              </a>
            </div>

            {/* Need help */}
            <div style={{ ...cardStyle, background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.3)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
                Need help installing?
              </h3>
              <p style={{ color: "#a1a1aa", fontSize: 13, lineHeight: 1.6 }}>
                We&apos;ll install it for you — free during beta. Email us at{" "}
                <a href="mailto:madhavsomani007@gmail.com" style={{ color: "#a29bfe" }}>
                  madhavsomani007@gmail.com
                </a>{" "}
                with your store URL and we&apos;ll have it running in 24 hours.
              </p>
            </div>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <a href="/retailer" style={{ color: "#71717a", textDecoration: "none", fontSize: 13 }}>← Back to Retailer Portal</a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#71717a",
  textTransform: "uppercase", letterSpacing: 0.5,
  display: "block", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "10px 14px", fontSize: 14,
  background: "#09090b", border: "1px solid #27272a",
  borderRadius: 8, color: "#e4e4e7", outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "#18181b", border: "1px solid #27272a",
  borderRadius: 16, padding: "24px 28px", marginBottom: 16,
};

const codeStyle: React.CSSProperties = {
  background: "#09090b", border: "1px solid #27272a",
  borderRadius: 8, padding: 16, fontSize: 12,
  overflow: "auto", color: "#a1a1aa", lineHeight: 1.6,
};

const copyBtnStyle: React.CSSProperties = {
  marginTop: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600,
  background: "#6C5CE7", color: "#fff", border: "none",
  borderRadius: 8, cursor: "pointer",
};
