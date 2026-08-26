import type { Metadata } from 'next'
import { RevenueDocuments } from '../revenue'

export const metadata: Metadata = { title: 'Payment' }

export default async function PaymentPage() {
  return <RevenueDocuments kind="payment" />
}
