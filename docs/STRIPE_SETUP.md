# Stripe Setup Guide

## Quick Start (5 minutes)

### 1. Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

### 2. Create Products in Stripe

In Stripe Dashboard → Products, create:

| Product | Price | Price ID |
|---------|-------|----------|
| VirtualFit Creator | $9/month | `price_creator_xxx` |
| VirtualFit Retailer | $49/month | `price_retailer_xxx` |

### 3. Create Payment Links (No-Code Option)

For static sites like Azure SWA, use [Stripe Payment Links](https://dashboard.stripe.com/payment-links):

1. Create a Payment Link for each plan
2. Copy the links (e.g., `https://buy.stripe.com/xxx`)
3. Replace the checkout URLs in `app/pricing/page.tsx`

### 4. Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_STRIPE_CREATOR_LINK=https://buy.stripe.com/creator_xxx
NEXT_PUBLIC_STRIPE_RETAILER_LINK=https://buy.stripe.com/retailer_xxx
```

### 5. For Server-Side Checkout (requires Node.js hosting)

If deploying to Vercel or a Node.js server:

1. Remove `output: 'export'` from `next.config.mjs`
2. Create `/api/checkout/route.ts` using Stripe SDK
3. Add `STRIPE_SECRET_KEY` to environment

```typescript
// app/api/checkout/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { priceId } = await req.json();
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.headers.get('origin')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/pricing`,
  });
  
  return Response.json({ url: session.url });
}
```

## Current Setup (Static Export)

The app currently uses static export for Azure SWA. Checkout uses mock flow:
- Clicking "Start Free Trial" → redirects to `/checkout/success` with test session
- No real payment processing yet

To enable real payments, either:
1. Use Stripe Payment Links (recommended for MVP)
2. Switch to Vercel/Node.js hosting for API routes
