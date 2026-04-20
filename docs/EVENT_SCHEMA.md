# VirtualFit Event Schema

## Overview
Two event streams exist. Both should converge to a single format for the admin stats dashboard.

## 1. Client-Side Analytics (localStorage)
**File:** `app/lib/analytics.ts`
**Storage:** `localStorage["virtualfit_analytics"]` (array, max 100 events)

```typescript
interface AnalyticsEvent {
  timestamp: string;       // ISO 8601
  event: EventName;        // enum below
  data?: Record<string, string | number | boolean>;
}

type EventName =
  | "page_view"
  | "waitlist_signup"
  | "checkout_start"
  | "checkout_complete"
  | "mirror_open"
  | "garment_select"
  | "widget_opened"        // NEW: from embed widget
  | "widget_closed"        // NEW: from embed widget
  | "garment_changed"      // NEW: from embed postMessage
  | "add_to_cart"          // NEW: from embed postMessage
  | "retailer_signup";     // NEW: from /retailer/signup
```

## 2. Server-Side Waitlist API (`/api/waitlist`)
**File:** `api/waitlist/index.js`
**Storage:** `/tmp/virtualfit-waitlist.jsonl` + email notification

```typescript
interface WaitlistEntry {
  email: string;
  revenue: string;          // revenue bracket OR event name (overloaded)
  wouldPay: string;         // "Yes, definitely" | "Maybe" | "No" | "retailer-signup"
  killerFeature: string;    // free text OR JSON metadata
  timestamp: string;        // ISO 8601
  source: string;           // "homepage" | "homepage-skip" | "embed-widget" | "retailer-signup"
  userAgent: string;
}
```

## 3. Embed Widget Events (postMessage → waitlist API)
**File:** `public/embed.js`
Events sent to `/api/waitlist` with overloaded fields:
- `email`: `"event@{shopId}"` or `"widget-open@{retailer}"`
- `revenue`: event name (e.g. `"widget_opened"`, `"garment_changed"`)
- `killerFeature`: JSON string with metadata

## Proposed Unified Format

For the admin stats dashboard to consume all events:

```typescript
interface UnifiedEvent {
  id: string;               // UUID or auto-increment
  timestamp: string;        // ISO 8601
  type: string;             // event name (from EventName enum)
  source: string;           // "client" | "embed" | "waitlist" | "stripe"
  shopId?: string;          // for retailer-specific analytics
  data: {
    email?: string;
    page?: string;
    plan?: string;
    garmentId?: string;
    productId?: string;
    hostname?: string;       // embed host domain
    [key: string]: unknown;
  };
}
```

## Migration Path
1. **Short term (now):** Admin dashboard reads from both localStorage analytics AND waitlist JSONL
2. **Medium term:** Add a `/api/events` POST endpoint that accepts `UnifiedEvent`
3. **Long term:** Replace localStorage analytics with server-side event tracking

## Stats Dashboard Compatibility
The admin stats dashboard (`/admin/stats`) reads from `localStorage["virtualfit_analytics"]`.
It should also fetch from `/api/waitlist` to include server-side events.

## CA1 ↔ CA2 Contract
- CA1 owns: pricing analytics, checkout events, admin stats dashboard
- CA2 owns: waitlist API, embed widget events, retailer signup events
- Both write to the same `EventName` type enum
- New event types should be added to the enum in `analytics.ts`
