import type { Metadata } from 'next'
import { RevenueDocuments } from '../revenue'

export const metadata: Metadata = { title: 'Invoice' }

export default async function InvoicePage() {
  return <RevenueDocuments kind="invoice" />
}
