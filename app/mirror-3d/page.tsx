"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * /mirror-3d now redirects to /mirror with the garment param.
 * The full 3D try-on experience lives at /mirror (with body tracking).
 */
function Mirror3DRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const model = searchParams.get("model");

  useEffect(() => {
    // Phase 7.14: simplified redirect logic.
    // Previously the `else` branch probed localStorage for a `virtualfit_gallery`
    // key that is **never written** anywhere in the app — a dead read that risked
    // silently overriding a fresh visit if a stale value ever existed. Now: if
    // `?model=` is present, forward it; otherwise just go to /mirror unmodified
    // and let the user pick a garment there.
    if (model) {
      router.replace(`/mirror?garment=${encodeURIComponent(model)}`);
    } else {
      router.replace("/mirror");
    }
  }, [model, router]);

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0c0c0e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#e4e4e7",
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
        <p style={{ fontSize: 16 }}>Redirecting to virtual mirror...</p>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>
          3D try-on now lives at <code>/mirror</code> with full body tracking
        </p>
      </div>
    </main>
  );
}

export default function Mirror3DPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0c0c0e" }} />}>
      <Mirror3DRedirect />
    </Suspense>
  );
}
