import { redirect } from "next/navigation";

/** Section index — students is the natural entry point. */
export default function PeopleIndexPage() {
  redirect("/people/students");
}
