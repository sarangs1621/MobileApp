import { redirect } from "next/navigation";

/** Attendance landing → the marking dashboard (the shell filters tabs by role). */
export default function AttendanceIndex() {
  redirect("/attendance/mark");
}
