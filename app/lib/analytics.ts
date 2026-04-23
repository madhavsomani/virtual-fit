// Simple client-side analytics tracker for VirtualFit.
// Uses localStorage for persistence (no server needed for static export).
//
// Phase 7.16: pruned to vision-fit. Removed marketplace/widget-embed/retailer
// convenience methods (`mirrorOpen`, `garmentSelect`, `widgetOpened`,
// `widgetClosed`, `garmentChanged`, `addToCart`, `retailerSignup`) and their
// matching `EventName` union members — they had zero callers anywhere in the
// app and belonged to the old marketplace pivot, not the webcam+3D vision.
// Phase 7.19: `/admin` and `/admin/stats` deleted (security theater + fake
// uploader). Phase 7.22: `/build-in-public` no longer reads this key (it
// was rendering visitor-localStorage as aggregate stats). Phase 7.23:
// `/redeem` no longer writes a `code_redeemed` event here (was bypassing
// the typed API with a write-only orphan event). The `virtualfit_analytics`
// key now has the four typed `track()` writers as its only producers.
// `getAll`/`clear` retained for future consumers.

type EventName =
  | "page_view"
  | "waitlist_signup"
  | "checkout_start"
  | "checkout_complete";

interface AnalyticsEvent {
  timestamp: string;
  event: EventName;
  data?: Record<string, string | number | boolean>;
}

const STORAGE_KEY = "virtualfit_analytics";

function getEvents(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEvent(event: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  try {
    const events = getEvents();
    events.push(event);
    // Keep only last 100 events to prevent localStorage bloat
    const trimmed = events.slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silent fail
  }
}

export function trackEvent(event: EventName, data?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;

  const payload: AnalyticsEvent = {
    timestamp: new Date().toISOString(),
    event,
    data,
  };

  saveEvent(payload);

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Track]", event, data);
  }
}

// Convenience functions — kept narrow on purpose. Add new methods only when
// a real caller exists, not speculatively.
export const analytics = {
  pageView: (page: string) => trackEvent("page_view", { page }),
  waitlistSignup: (email: string) =>
    trackEvent("waitlist_signup", { email: email.slice(0, 3) + "***" }),
  checkoutStart: (plan: string) => trackEvent("checkout_start", { plan }),
  checkoutComplete: (plan: string, sessionId: string) =>
    trackEvent("checkout_complete", { plan, sessionId }),

  // Get all tracked events (for debugging/export)
  getAll: () => getEvents(),

  // Clear all events
  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
};
