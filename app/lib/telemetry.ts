/**
 * Lightweight client-side telemetry for VirtualFit.
 * Events are stored in localStorage and batched to /api/waitlist (reused endpoint).
 * No external dependencies. ~1KB.
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

  // Fire-and-forget to server (reuse waitlist endpoint as telemetry sink)
  try {
    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `telemetry@${getSessionId().slice(0, 8)}`,
        source: 'telemetry',
        revenue: event,
        killerFeature: JSON.stringify(props || {}),
      }),
    }).catch(() => {}); // silent fail
  } catch {}

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
