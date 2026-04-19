"use client";

import Link from "next/link";
import { useState } from "react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying it out",
    features: [
      "3 try-ons per month",
      "5 garments",
      "Watermarked exports",
      "Community support",
    ],
    cta: "Get Started",
    href: "/mirror",
    highlight: false,
  },
  {
    name: "Creator",
    price: "$9",
    period: "/month",
    description: "For influencers & content creators",
    features: [
      "Unlimited try-ons",
      "50 garments",
      "Watermark-free clip export",
      "Priority support",
      "Early access to new features",
    ],
    cta: "Start Free Trial",
    href: "#checkout-creator",
    highlight: true,
  },
  {
    name: "Retailer",
    price: "$49",
    period: "/month",
    description: "Embed virtual try-on in your store",
    features: [
      "Embeddable widget",
      "Custom branding",
      "500 garments",
      "Analytics dashboard",
      "API access",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    href: "#checkout-retailer",
    highlight: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: string) => {
    if (plan === "Free") {
      window.location.href = "/mirror";
      return;
    }
    
    setLoading(plan);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.toLowerCase(),
          email: "", // Would collect from user in production
        }),
      });
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to checkout (or success in test mode)
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Checkout failed");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <Link
            href="/"
            style={{
              color: "#6C5CE7",
              fontSize: 14,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 24,
            }}
          >
            ← Back to Home
          </Link>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              margin: "0 0 16px",
              letterSpacing: -1,
            }}
          >
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 18, color: "#a1a1aa", margin: 0 }}>
            Start free. Upgrade when you&apos;re ready to grow.
          </p>
        </div>

        {/* Pricing Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.highlight
                  ? "linear-gradient(135deg, #6C5CE7 0%, #5B4BD5 100%)"
                  : "#18181b",
                border: plan.highlight ? "none" : "1px solid #27272a",
                borderRadius: 20,
                padding: 32,
                position: "relative",
                transform: plan.highlight ? "scale(1.02)" : "none",
              }}
            >
              {plan.highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#fff",
                    color: "#6C5CE7",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: 20,
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  margin: "0 0 8px",
                  color: plan.highlight ? "#fff" : "#e4e4e7",
                }}
              >
                {plan.name}
              </h2>

              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    color: plan.highlight ? "#fff" : "#e4e4e7",
                  }}
                >
                  {plan.price}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    color: plan.highlight
                      ? "rgba(255,255,255,0.8)"
                      : "#71717a",
                  }}
                >
                  {plan.period}
                </span>
              </div>

              <p
                style={{
                  fontSize: 14,
                  color: plan.highlight ? "rgba(255,255,255,0.8)" : "#71717a",
                  margin: "0 0 24px",
                }}
              >
                {plan.description}
              </p>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 32px",
                }}
              >
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 14,
                      color: plan.highlight ? "#fff" : "#a1a1aa",
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ color: plan.highlight ? "#fff" : "#6C5CE7" }}>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.name)}
                disabled={loading === plan.name}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 12,
                  cursor: loading === plan.name ? "wait" : "pointer",
                  background: plan.highlight ? "#fff" : "#6C5CE7",
                  color: plan.highlight ? "#6C5CE7" : "#fff",
                  transition: "opacity 0.15s",
                  opacity: loading === plan.name ? 0.7 : 1,
                }}
              >
                {loading === plan.name ? "Loading..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div style={{ marginTop: 80, textAlign: "center" }}>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 32,
            }}
          >
            Questions?
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
              textAlign: "left",
            }}
          >
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes! Cancel your subscription at any time. No questions asked.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards via Stripe.",
              },
              {
                q: "Is there a free trial?",
                a: "The Creator plan includes a 7-day free trial. No credit card required to start.",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "#e4e4e7",
                  }}
                >
                  {faq.q}
                </div>
                <div style={{ fontSize: 14, color: "#71717a" }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: 64,
            fontSize: 12,
            color: "#3f3f46",
          }}
        >
          Built by Madhav Somani · VirtualFit © 2026
        </p>
      </div>
    </main>
  );
}
