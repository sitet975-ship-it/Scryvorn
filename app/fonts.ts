import { Cormorant_Garamond, Inter } from "next/font/google";

/**
 * Web fonts via next/font (self-hosted at build time; no runtime requests to
 * Google). Each declares system fallbacks, so text stays readable if a font
 * cannot be loaded. Exposed as CSS variables used by tailwind.config.ts.
 */
export const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
  fallback: ["Georgia", "Cambria", "Times New Roman", "serif"],
});

export const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});
