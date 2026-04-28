import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VirtualFit",
  description: "Try on any outfit virtually before you buy."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
