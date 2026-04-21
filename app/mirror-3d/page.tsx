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
    // Redirect to /mirror with the garment param
    if (model) {
      router.replace(`/mirror?garment=${encodeURIComponent(model)}`);
    } else {
      // Check localStorage for last generated model
      try {
        const gallery = localStorage.getItem("virtualfit_gallery");
        if (gallery) {
          const items = JSON.parse(gallery);
          if (items.length > 0 && items[0].modelUrl) {
            router.replace(`/mirror?garment=${encodeURIComponent(items[0].modelUrl)}`);
            return;
          }
        }
      } catch {}
      // No model — go to generate page
      router.replace("/generate-3d");
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
