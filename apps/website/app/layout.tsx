import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/bold";
import "@phosphor-icons/web/fill";

import "../src/styles/fonts.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/site.css";

import type { Metadata } from "next";
import type React from "react";

import { QuickActions } from "@/src/components/site/QuickActions";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { SiteHeader } from "@/src/components/site/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "Sri Gujarati Vidyalaya Higher Secondary School, Kozhikode",
    template: "%s — Sri Gujarati Vidyalaya",
  },
  description:
    "A Kerala Government recognised, English-medium co-educational school nurturing the total development of every child since 1869. Mananchira, Kozhikode.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "var(--surface-page)" }}>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <QuickActions />
      </body>
    </html>
  );
}
