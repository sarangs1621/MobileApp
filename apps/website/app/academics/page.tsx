import type { Metadata } from "next";

import { AcademicsContent } from "@/src/components/pages/academics";

export const metadata: Metadata = {
  title: "Academics",
  description:
    "From play-based early years to Higher Secondary Science & Commerce streams — rigour, balance and joy in learning.",
};

export default function AcademicsPage() {
  return <AcademicsContent />;
}
