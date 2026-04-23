/**
 * Lightweight client-side telemetry for VirtualFit.
 *
 * Phase 7.12: removed the network sink. Previously `track()` POSTed every
 * event to `/api/waitlist` with a fake `telemetry@<sessionId>` email and
 * smuggled the event into the `revenue` / `killerFeature` fields. That
 * abused the waitlist endpoint, exfiltrated a persistent UUID without
 * consent, and 404-stormed (no such route exists in this repo). Local-only
 * now: a 200-event ring buffer in localStorage for user-side debug.
 */

const STORAGE_KEY = 'virtualfit_telemetry';
const SESSION_KEY = 'virtualfit_session_id';
const MAX_EVENTS = 200;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface TelemetryEvent {
  event: string;
  props?: Record<string, string | number | boolean>;
  ts: string;
  sessionId: string;
}

function getEvents(): TelemetryEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEvent(evt: TelemetryEvent) {
  if (typeof window === 'undefined') return;
  try {
    const events = getEvents();
    events.push(evt);
    // Keep only last MAX_EVENTS
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

/**
 * Track an event. Stores locally and optionally sends to server.
 */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;

  const evt: TelemetryEvent = {
    event,
    props,
    ts: new Date().toISOString(),
    sessionId: getSessionId(),
  };

  saveEvent(evt);

  // Phase 7.12: network sink removed (see file header). Local-only.

  // Console in dev
  if (process.env.NODE_ENV === 'development') {
    console.log('[telemetry]', event, props);
  }
}

/** Get all stored events (for debug/export) */
export function getAll(): TelemetryEvent[] {
  return getEvents();
}

/** Clear stored events */
export function clear() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Get current session ID */
export function session(): string {
  return getSessionId();
}
