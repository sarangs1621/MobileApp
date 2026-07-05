import { redirect } from "next/navigation";

/** Section index — academic years is the natural entry point. */
export default function AcademicIndexPage() {
  redirect("/academic/years");
}
