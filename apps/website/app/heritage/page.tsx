import type { Metadata } from "next";

import { HeritageContent } from "@/src/components/pages/heritage";

export const metadata: Metadata = {
  title: "Heritage",
  description:
    "For over 150 years, Sri Gujarati Vidyalaya has shaped generations of learners in Kozhikode — rooted in humility, reaching for excellence.",
};

export default function HeritagePage() {
  return <HeritageContent />;
}
