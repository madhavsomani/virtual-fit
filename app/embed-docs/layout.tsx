import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Embed · <virtualfit-mirror> — VirtualFit",
  description:
    "Drop the VirtualFit 3D Mirror into any Shopify storefront with one <script> tag and one custom element. No build step. No npm install.",
};
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
