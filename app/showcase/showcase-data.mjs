// Phase 8.5 — Showcase data layer.
//
// SHIPPING-READY catalog of high-fidelity sample garments with the fabric
// metadata Phase 8.4's `pbr-fabric.mjs` consumes. Single source of truth
// for both the /showcase page and the build-in-public counter.
//
// Each entry MUST have:
//   - `id`              kebab-case, used in URL params + analytics
//   - `name`            display name
//   - `fabric`          one of KNOWN_FABRIC_KINDS (drives PBR preset)
//   - `imageUrl`        hero thumbnail (preferably with transparent bg)
//   - `glbUrl`          REQUIRED: vision says NO 2D fallback. Every entry
//                       must point at a real GLB or it doesn't ship.
//   - `palette.primary` hex color for hero card accent
//
// Optional:
//   - `tagline`         one-liner shown on card
//   - `category`        future filter key (Phase 8.6 catalog will use this)

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   fabric: 'cotton' | 'denim' | 'silk' | 'satin' | 'leather' | 'wool' | 'polyester' | 'metallic',
 *   imageUrl: string,
 *   glbUrl: string,
 *   palette: { primary: string },
 *   tagline?: string,
 *   category?: string
 * }} ShowcaseGarment
 */

/** @type {ReadonlyArray<ShowcaseGarment>} */
export const SHOWCASE_GARMENTS = Object.freeze([
  {
    id: "demo-tshirt-cotton",
    name: "Classic Cotton Tee",
    fabric: "cotton",
    imageUrl: "/garments/tshirt-blue.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#4f7cff" },
    tagline: "Heavyweight cotton — the everyday baseline.",
    category: "tops",
  },
  {
    id: "denim-jacket-classic",
    name: "Selvedge Denim Jacket",
    fabric: "denim",
    imageUrl: "/garments/jacket-black.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#1a2540" },
    tagline: "14oz selvedge — slight specular, structured drape.",
    category: "outerwear",
  },
  {
    id: "silk-shirt-emerald",
    name: "Emerald Silk Shirt",
    fabric: "silk",
    imageUrl: "/garments/polo-green.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#0e8a52" },
    tagline: "Charmeuse weave — high sheen, low roughness.",
    category: "tops",
  },
  {
    id: "leather-bomber",
    name: "Vintage Leather Bomber",
    fabric: "leather",
    imageUrl: "/garments/jacket-black.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#2a1a0c" },
    tagline: "Aniline leather — clearcoat catches every light source.",
    category: "outerwear",
  },
  {
    id: "wool-knit-mustard",
    name: "Mustard Wool Knit",
    fabric: "wool",
    imageUrl: "/garments/yellow-shirt.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#c79029" },
    tagline: "Lambswool fleece — high roughness + sheen for fuzz feel.",
    category: "tops",
  },
]);

/**
 * Build the canonical /mirror URL for a given showcase garment. Used by
 * both the /showcase Try button and any external embed.
 */
export function mirrorUrlFor(garment) {
  if (!garment || typeof garment.glbUrl !== "string") return "/mirror";
  const params = new URLSearchParams();
  params.set("garment", garment.glbUrl);
  if (garment.id) params.set("showcaseId", garment.id);
  if (garment.fabric) params.set("fabric", garment.fabric);
  return `/mirror?${params.toString()}`;
}

/** Lookup helper for SEO-friendly per-garment routes (future). */
export function findShowcaseGarment(id) {
  if (typeof id !== "string") return null;
  return SHOWCASE_GARMENTS.find((g) => g.id === id) ?? null;
}
