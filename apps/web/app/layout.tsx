import { LocaleProvider } from "@repo/i18n";
import { ThemeProvider } from "@repo/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TRPCProvider } from "@/src/trpc/react";

import "./globals.css";

export const metadata: Metadata = {
  title: "School Portal",
  description: "School Management Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>
          <ThemeProvider>
            <LocaleProvider locale="en">{children}</LocaleProvider>
          </ThemeProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
