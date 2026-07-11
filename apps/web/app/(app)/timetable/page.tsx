import { redirect } from "next/navigation";

/** Section index — the bell schedule is the natural entry point (periods gate the grid). */
export default function TimetableIndexPage() {
  redirect("/timetable/schedule");
}
