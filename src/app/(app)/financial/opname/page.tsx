import type { Metadata } from 'next'
import { RevenueDocuments } from '../revenue'

export const metadata: Metadata = { title: 'Opname' }

export default async function OpnamePage() {
  return <RevenueDocuments kind="opname" />
}
