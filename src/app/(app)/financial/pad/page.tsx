import type { Metadata } from 'next'
import { RevenueDocuments } from '../revenue'

export const metadata: Metadata = { title: 'PAD' }

export default async function PadPage() {
  return <RevenueDocuments kind="pad" />
}
