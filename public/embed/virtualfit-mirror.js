/* virtualfit-mirror web component
 * Drop into any storefront:
 *   <script type="module" src="https://virtualfit.app/embed/virtualfit-mirror.js"></script>
 *   <virtualfit-mirror garment="https://.../tee.glb" fabric="cotton"></virtualfit-mirror>
 * Apache-2.0 · https://virtualfit.app/api-docs
 */
// Phase 8.14 — <virtualfit-mirror> web component for Shopify embeds.
//
// Single-file standalone custom element. Drops onto any storefront via:
//
//   <script type="module"
//     src="https://virtualfit.app/embed/virtualfit-mirror.js"></script>
//   <virtualfit-mirror
//     garment="https://cdn.virtualfit.app/models/demo-tshirt.glb"
//     fabric="cotton"
//     mode="topwear"
//     height="640"
//     analytics="shop_xyz"></virtualfit-mirror>
//
// The element renders an <iframe> pointed at /mirror?garment=...&fabric=...
// (the same canonical mirror page the rest of the app uses) so the 3D
// pipeline stays in one place. The iframe is sandboxed:
//   allow-scripts allow-same-origin
//   allow="camera; xr-spatial-tracking; fullscreen"
//
// We bridge `postMessage` events from the inner mirror back out as
// CustomEvents on the host element so retailer JS can react to:
//   "vfit:ready" | "vfit:tryon-start" | "vfit:tryon-snapshot" | "vfit:error"
//
// This module is also tree-shakeable into a SSR-safe import (the
// customElements registration is guarded behind `typeof window`).
//
// HARD RULES upheld:
//   - 3D-only: garment attr must end in .glb (validated, otherwise error event)
//   - No paid API URLs referenced
//   - No 2D fallback iframe path

const VERSION = "1.0.0";
const DEFAULT_ORIGIN = "https://virtualfit.app";
const DEFAULT_HEIGHT = 600;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 1600;
const VALID_MODES = Object.freeze(["topwear", "footwear"]);
const ALLOWED_EVENTS = Object.freeze([
  "vfit:ready",
  "vfit:tryon-start",
  "vfit:tryon-snapshot",
  "vfit:error",
]);

const GLB_RE = /\.glb(\?.*)?$/i;
const HTTPS_RE = /^https:\/\//i;

export function buildMirrorUrl({ origin = DEFAULT_ORIGIN, garment, fabric, mode, analytics } = {}) {
  if (typeof origin !== "string" || !HTTPS_RE.test(origin)) {
    throw new Error("buildMirrorUrl: origin must be https://");
  }
  if (typeof garment !== "string" || !HTTPS_RE.test(garment) || !GLB_RE.test(garment)) {
    throw new Error("buildMirrorUrl: garment must be https URL ending in .glb");
  }
  const params = new URLSearchParams();
  params.set("garment", garment);
  params.set("embed", "1");
  if (fabric) params.set("fabric", fabric);
  if (mode) {
    if (!VALID_MODES.includes(mode)) {
      throw new Error(`buildMirrorUrl: mode must be one of ${VALID_MODES.join(",")}`);
    }
    params.set("mode", mode);
  }
  if (analytics) params.set("shop", analytics);
  const base = origin.replace(/\/$/, "");
  return `${base}/mirror?${params.toString()}`;
}

export function clampHeight(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return DEFAULT_HEIGHT;
  if (n < MIN_HEIGHT) return MIN_HEIGHT;
  if (n > MAX_HEIGHT) return MAX_HEIGHT;
  return Math.floor(n);
}

/**
 * Validate an inbound postMessage event. Returns null if untrusted.
 */
export function parseInboundMessage(event, { trustedOrigin = DEFAULT_ORIGIN } = {}) {
  if (!event || event.origin !== trustedOrigin) return null;
  const data = event.data;
  if (!data || typeof data !== "object" || typeof data.type !== "string") return null;
  if (!ALLOWED_EVENTS.includes(data.type)) return null;
  return { type: data.type, payload: data.payload ?? null };
}

/**
 * Pure constructor for the iframe DOM (testable in node with a fake
 * Document). Returns the element so callers can append + listen.
 */
export function createMirrorIframe(doc, { src, height }) {
  const f = doc.createElement("iframe");
  f.src = src;
  f.title = "VirtualFit 3D Mirror";
  f.allow = "camera; xr-spatial-tracking; fullscreen";
  f.setAttribute("sandbox", "allow-scripts allow-same-origin");
  f.style.width = "100%";
  f.style.height = `${clampHeight(height)}px`;
  f.style.border = "0";
  f.style.display = "block";
  f.loading = "lazy";
  f.referrerPolicy = "strict-origin-when-cross-origin";
  return f;
}

const HTMLElementBase = (typeof HTMLElement !== "undefined")
  ? HTMLElement
  : class { /* SSR/node stub: customElements.define is also gated below */ };

class VirtualFitMirrorElement extends HTMLElementBase {
  static get observedAttributes() {
    return ["garment", "fabric", "mode", "height", "analytics", "origin"];
  }

  constructor() {
    super();
    this._messageHandler = null;
    this._iframe = null;
  }

  connectedCallback() {
    this._render();
    this._messageHandler = (ev) => {
      const trusted = this.getAttribute("origin") || DEFAULT_ORIGIN;
      const parsed = parseInboundMessage(ev, { trustedOrigin: trusted });
      if (!parsed) return;
      this.dispatchEvent(new CustomEvent(parsed.type, { detail: parsed.payload, bubbles: true, composed: true }));
    };
    window.addEventListener("message", this._messageHandler);
  }

  disconnectedCallback() {
    if (this._messageHandler) {
      window.removeEventListener("message", this._messageHandler);
      this._messageHandler = null;
    }
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }

  _render() {
    while (this.firstChild) this.removeChild(this.firstChild);
    let src;
    try {
      src = buildMirrorUrl({
        origin: this.getAttribute("origin") || DEFAULT_ORIGIN,
        garment: this.getAttribute("garment"),
        fabric: this.getAttribute("fabric") || undefined,
        mode: this.getAttribute("mode") || undefined,
        analytics: this.getAttribute("analytics") || undefined,
      });
    } catch (err) {
      this.dispatchEvent(new CustomEvent("vfit:error", { detail: { message: err.message }, bubbles: true, composed: true }));
      const note = document.createElement("div");
      note.style.cssText = "padding:1rem;font-family:system-ui;color:#9b2c2c;background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;";
      note.textContent = `VirtualFit mirror: ${err.message}`;
      this.appendChild(note);
      return;
    }
    const iframe = createMirrorIframe(document, { src, height: this.getAttribute("height") });
    this.appendChild(iframe);
    this._iframe = iframe;
  }
}

export const VFIT_EMBED_VERSION = VERSION;
export const VFIT_EMBED_DEFAULTS = Object.freeze({
  origin: DEFAULT_ORIGIN,
  height: DEFAULT_HEIGHT,
  minHeight: MIN_HEIGHT,
  maxHeight: MAX_HEIGHT,
  validModes: VALID_MODES,
  allowedEvents: ALLOWED_EVENTS,
});

if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  if (!customElements.get("virtualfit-mirror")) {
    customElements.define("virtualfit-mirror", VirtualFitMirrorElement);
  }
}

export { VirtualFitMirrorElement };
