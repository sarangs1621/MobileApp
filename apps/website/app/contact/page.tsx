import type { Metadata } from "next";

import { ContactContent } from "@/src/components/pages/contact";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about admissions, a campus visit, or careers at Gujarati Vidyalaya — reach out and we'll respond promptly.",
};

export default function ContactPage() {
  return <ContactContent />;
}
