import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/server/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nextflix — a teaching clone",
    template: "%s · Nextflix",
  },
  description:
    "A Netflix clone built to reproduce and measure Netflix's published web engineering practices.",
  // Keep search engines out: this is a personal teaching project that imitates a real
  // brand's interface, and it should never surface as if it were the real thing.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
