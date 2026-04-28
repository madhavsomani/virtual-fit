import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API · /api/v1/tryOn — VirtualFit",
  description:
    "Public Try-On API spec. POST garment GLB + customer image, get back a 3D-rendered try-on. JWT auth, rate-limited, no paid APIs in the pipeline.",
};

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
