import type { Metadata } from "next";

import { AdmissionsContent } from "@/src/components/pages/admissions";

export const metadata: Metadata = {
  title: "Admissions",
  description:
    "A warm, guided admissions experience — from first enquiry to your child's first day. Admissions open 2026-27.",
};

export default function AdmissionsPage() {
  return <AdmissionsContent />;
}
