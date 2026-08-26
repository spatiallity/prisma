import { redirect } from 'next/navigation'

/** Section 7 lists Today's Schedule under Dashboard; Team Schedule is the same
 *  view of v_today_schedule, so there is one page rather than two. */
export default function TodayShortcut() {
  redirect('/schedule/team')
}
