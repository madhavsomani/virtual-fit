import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Style Me — Find Similar Garments | VirtualFit",
  description:
    "Type a vibe (\"oversized cream cotton tee\") or pick a garment — get the 3 closest matches from our 3D catalog. 100% local, no AI APIs.",
};

export default function StyleMeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
