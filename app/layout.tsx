import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  // Phase 7.47: metadataBase resolves all relative meta URLs (og:image,
  // twitter:image, canonical, etc.) to fully-qualified https://virtualfit.app
  // URLs in the rendered HTML. Some scrapers refuse relative paths.
  metadataBase: new URL("https://virtualfit.app"),
  title: "VirtualFit - Virtual Try-On",
  description: "Try on clothes virtually with AI-powered 3D body tracking",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VirtualFit",
  },
  openGraph: {
    title: "VirtualFit - Virtual Try-On",
    description: "Upload any clothing photo and see it on you in real-time with 3D body tracking",
    type: "website",
    locale: "en_US",
    siteName: "VirtualFit",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VirtualFit - Virtual Try-On",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VirtualFit - Virtual Try-On",
    description: "Try on clothes virtually with AI-powered 3D body tracking",
    images: ["/og-image.png"],
  },
  keywords: ["virtual try-on", "AR", "clothes", "fashion", "3D", "MediaPipe", "body tracking"],
  authors: [{ name: "VirtualFit" }],
  robots: "index, follow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://storage.googleapis.com" />
        {/* Phase 7.77: JSON-LD structured data for rich results.
            SoftwareApplication is the right schema for a webcam-based
            try-on app — not WebPage / Product. Google's rich-result
            tester accepts SoftwareApplication for browser-based tools
            and surfaces ratings + price in SERPs when both are present.
            Price is "0" because the free tier is the actual product;
            paid tiers live on /pricing and would warrant their own
            Product/Offer JSON-LD if/when conversion data justifies. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "VirtualFit",
              description:
                "Webcam-based virtual try-on with 3D body tracking. Upload any clothing photo and see it on you in real-time.",
              applicationCategory: "LifestyleApplication",
              operatingSystem: "Web Browser",
              url: "https://virtualfit.app",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              creator: {
                "@type": "Organization",
                name: "VirtualFit",
                url: "https://virtualfit.app",
              },
            }),
          }}
        />
        <style>{`
          /* Skip link for accessibility */
          .skip-link {
            position: absolute;
            top: -40px;
            left: 0;
            background: #6C5CE7;
            color: white;
            padding: 8px 16px;
            z-index: 9999;
            font-weight: 600;
            text-decoration: none;
          }
          .skip-link:focus {
            top: 0;
          }
          /* Focus styles for keyboard navigation */
          :focus-visible {
            outline: 2px solid #6C5CE7;
            outline-offset: 2px;
          }
          /* Remove outline for mouse users */
          :focus:not(:focus-visible) {
            outline: none;
          }
        `}</style>
      </head>
      <body style={{ fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
