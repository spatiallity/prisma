import { redirect } from 'next/navigation'

/** Section 7 lists Master Vendor under Administration; it is the same data as
 *  the operational vendor list, so there is one page rather than two. */
export default function MasterVendorPage() {
  redirect('/vendor')
}
