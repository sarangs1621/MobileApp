import { ThemeProvider } from "@repo/ui";
import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Newsreader } from "next/font/google";
import type { ReactNode } from "react";

import { LocaleGate } from "@/src/i18n/locale-gate";
import { TRPCProvider } from "@/src/trpc/react";

import "./globals.css";

// Heritage identity pair: Hanken Grotesk for UI/body (`--font-sans`), Newsreader
// for headings (`--font-display`, applied via globals.css base layer). `swap`
// avoids invisible text (FOIT).
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const displaySerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
// IBM Plex Mono — invoice/receipt/document numbers (design handoff §Design Tokens).
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "School Portal",
  description: "School Management Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions inject attributes (bis_register,
    // bis_skin_checked, __processed_*) onto <html>/<body> before React hydrates,
    // producing a dev-only attribute mismatch (BUG-7). This silences that one-level
    // attribute diff only — genuine content/tree mismatches still warn. The app sets
    // no server/client-divergent attributes here (ThemeProvider is pure context).
    <html
      lang="en"
      className={`${sans.variable} ${displaySerif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        <TRPCProvider>
          <ThemeProvider>
            <LocaleGate>{children}</LocaleGate>
          </ThemeProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
