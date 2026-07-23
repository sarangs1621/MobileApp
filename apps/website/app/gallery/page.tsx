import type { Metadata } from "next";

import { GalleryContent } from "@/src/components/pages/gallery";

export const metadata: Metadata = {
  title: "Campus & Gallery",
  description:
    "Moments from our campus — classrooms, celebrations, sport and the green campus our students call home.",
};

export default function GalleryPage() {
  return <GalleryContent />;
}
