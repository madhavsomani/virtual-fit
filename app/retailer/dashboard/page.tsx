"use client";

// Phase 8.8 — /retailer/dashboard
//
// SKU upload form for retailers. Validates input client-side against
// the formal Phase 8.7 GARMENT_SCHEMA (no server round-trip needed
// for the obvious mistakes). On submit, POSTs to /api/retailer/garments
// (Phase 8.8.1, follow-up) and triggers /api/generate-3d if no glbUrl
// is provided. Persists draft + uploaded gallery in localStorage so
// retailers don't lose work if they reload.
//
// Auth: gated on `vfit:retailer:shopId` from /retailer/signup. If
// missing → CTA back to signup. (Real auth lands with the BFF in
// Phase 9.)

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  validateGarment,
} from "../../lib/garment-schema.mjs";
import { KNOWN_FABRIC_KINDS } from "../../lib/pbr-fabric.mjs";

const CATEGORIES = ["tops", "outerwear", "bottoms", "dresses", "footwear", "accessories"];
const STORAGE_KEY = "vfit:retailer:dashboard:v1";
const SHOP_KEY = "vfit:retailer:shopId";

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadGallery() {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGallery(items) {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode — ignore */
  }
}

const EMPTY_FORM = {
  id: "",
  sku: "",
  name: "",
  brand: "",
  category: "tops",
  fabric: "cotton",
  price: "",
  imageUrl: "",
  glbUrl: "",
  paletteHex: "#4f7cff",
  tagline: "",
};

export default function RetailerDashboardPage() {
  const [shopId, setShopId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const s = safeStorage();
    if (!s) return;
    setShopId(s.getItem(SHOP_KEY) || "");
    setItems(loadGallery());
  }, []);

  const candidate = useMemo(() => {
    const out: Record<string, unknown> = {
      id: form.id.trim(),
      name: form.name.trim(),
      category: form.category,
      fabric: form.fabric,
      imageUrl: form.imageUrl.trim(),
      glbUrl: form.glbUrl.trim(),
      palette: { primary: form.paletteHex },
    };
    if (form.sku.trim()) out.sku = form.sku.trim();
    if (form.brand.trim()) out.brand = form.brand.trim();
    if (form.tagline.trim()) out.tagline = form.tagline.trim();
    if (form.price !== "" && !Number.isNaN(Number(form.price))) {
      out.price = Number(form.price);
    }
    return out;
  }, [form]);

  const validation = useMemo(() => validateGarment(candidate), [candidate]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFlash(null);
  }

  function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFlash(null);
    try {
      if (!validation.valid) {
        setFlash({ kind: "error", message: validation.errors.join("; ") });
        return;
      }
      if (items.some((it) => it.id === candidate.id)) {
        setFlash({ kind: "error", message: `id '${candidate.id}' already exists in your dashboard.` });
        return;
      }
      const next = [...items, { ...candidate, _shopId: shopId, _addedAt: new Date().toISOString() }];
      setItems(next);
      saveGallery(next);
      setForm(EMPTY_FORM);
      setFlash({ kind: "success", message: `Added ${candidate.name}.` });
    } finally {
      setSubmitting(false);
    }
  }

  function removeItem(id) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    saveGallery(next);
  }

  if (!shopId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Sign up first</h1>
        <p className="mt-3 text-slate-600">
          The dashboard is gated on a retailer account. Takes 60 seconds.
        </p>
        <Link
          href="/retailer/signup"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          → Retailer signup
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · Retailer
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Shop ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{shopId}</code>
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        {/* Upload form */}
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200"
          aria-label="Add new garment"
        >
          <h2 className="text-lg font-semibold text-slate-900">Add a garment</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="ID *"
              value={form.id}
              onChange={(v) => update("id", v)}
              placeholder="kebab-case-id"
              required
            />
            <Field
              label="SKU"
              value={form.sku}
              onChange={(v) => update("sku", v)}
              placeholder="ACME-TEE-BLU-M"
            />
          </div>

          <Field
            label="Name *"
            value={form.name}
            onChange={(v) => update("name", v)}
            placeholder="Classic Cotton Tee"
            required
          />
          <Field
            label="Brand"
            value={form.brand}
            onChange={(v) => update("brand", v)}
            placeholder="Acme Apparel"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Category *"
              value={form.category}
              onChange={(v) => update("category", v)}
              options={CATEGORIES}
            />
            <Select
              label="Fabric *"
              value={form.fabric}
              onChange={(v) => update("fabric", v)}
              options={[...KNOWN_FABRIC_KINDS]}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field
              label="Price (USD)"
              value={form.price}
              onChange={(v) => update("price", v)}
              placeholder="59"
              type="number"
            />
            <label className="text-xs font-medium text-slate-600">
              Palette
              <input
                type="color"
                value={form.paletteHex}
                onChange={(e) => update("paletteHex", e.target.value)}
                className="mt-1 h-10 w-16 cursor-pointer rounded border border-slate-300"
                aria-label="Palette primary colour"
              />
            </label>
          </div>

          <Field
            label="Image URL *"
            value={form.imageUrl}
            onChange={(v) => update("imageUrl", v)}
            placeholder="/garments/tshirt-blue.png"
            required
          />
          <Field
            label="GLB URL *"
            value={form.glbUrl}
            onChange={(v) => update("glbUrl", v)}
            placeholder="/models/your-garment.glb"
            required
            hint="Must end in .glb. No 2D fallback — we're a 3D-only platform."
          />

          <Field
            label="Tagline"
            value={form.tagline}
            onChange={(v) => update("tagline", v)}
            placeholder="Heavyweight cotton — the everyday baseline."
          />

          {flash && (
            <p
              role="status"
              className={
                flash.kind === "error"
                  ? "rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  : "rounded-lg bg-green-50 p-3 text-sm text-green-700"
              }
            >
              {flash.message}
            </p>
          )}

          {!validation.valid && (form.id || form.name) && (
            <ul
              className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
              aria-label="Validation issues"
            >
              {validation.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={submitting || !validation.valid}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Adding…" : "Add to gallery"}
          </button>
        </form>

        {/* Gallery */}
        <section aria-label="Your gallery">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your gallery</h2>
            <span className="text-sm text-slate-500">
              {items.length} {items.length === 1 ? "garment" : "garments"}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-12 text-center text-sm text-slate-500">
              Nothing yet. Add your first garment on the left.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((g) => (
                <li
                  key={g.id}
                  className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200"
                >
                  <div
                    className="h-32 w-full"
                    style={{ backgroundColor: g.palette?.primary || "#e2e8f0" }}
                  />
                  <div className="space-y-1 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {g.name}
                      </h3>
                      {typeof g.price === "number" && (
                        <span className="text-xs text-slate-700">${g.price}</span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-slate-400">{g.id}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{g.fabric}</Badge>
                      <Badge tone="blue">{g.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/mirror?garment=${encodeURIComponent(
                          g.glbUrl,
                        )}&fabric=${g.fabric}&dashboardId=${g.id}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Try on →
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(g.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                        aria-label={`Remove ${g.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, required, type = "text", hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      {hint && <span className="mt-1 block text-[10px] font-normal text-slate-400">{hint}</span>}
    </label>
  );
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "blue" }) {
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}
