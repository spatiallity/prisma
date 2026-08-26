import type { Metadata } from 'next'
import { RevenueDocuments } from '../revenue'

export const metadata: Metadata = { title: 'Contract' }

export default async function ContractPage() {
  return <RevenueDocuments kind="contract" />
}
