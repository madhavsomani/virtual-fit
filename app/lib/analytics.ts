// Simple client-side analytics tracker for VirtualFit
// Uses localStorage for persistence (no server needed for static export)

type EventName =
  | "page_view"
  | "waitlist_signup"
  | "checkout_start"
  | "checkout_complete"
  | "mirror_open"
  | "garment_select";

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

// Convenience functions
export const analytics = {
  pageView: (page: string) => trackEvent("page_view", { page }),
  waitlistSignup: (email: string) => trackEvent("waitlist_signup", { email: email.slice(0, 3) + "***" }),
  checkoutStart: (plan: string) => trackEvent("checkout_start", { plan }),
  checkoutComplete: (plan: string, sessionId: string) => trackEvent("checkout_complete", { plan, sessionId }),
  mirrorOpen: () => trackEvent("mirror_open"),
  garmentSelect: (garmentId: string) => trackEvent("garment_select", { garmentId }),
  
  // Get all tracked events (for debugging/export)
  getAll: () => getEvents(),
  
  // Clear all events
  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
};
