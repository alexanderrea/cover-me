import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Three type layers, per the design system: Archivo for display, Inter for
 * body and UI, JetBrains Mono for the technical layer (labels, IDs, tags).
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COVER ME",
  description:
    "Cover letters written from your resume, your LinkedIn and live research on the company.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAFAF7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
