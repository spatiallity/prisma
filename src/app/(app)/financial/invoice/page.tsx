import type { Metadata } from 'next'
import { RoutingMonitor } from '../../routing/page'
import { RevenueDocuments } from '../revenue'

export const metadata: Metadata = { title: 'Invoice' }

/** The routing matrix (Document Control → Finance) sits right here so the
 *  approval position of each invoice is visible without another click. */
export default async function InvoicePage() {
  return (
    <>
      <RoutingMonitor mode="open" />
      <div className="mt-8">
        <RevenueDocuments kind="invoice" />
      </div>
    </>
  )
}
