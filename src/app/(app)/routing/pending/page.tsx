import type { Metadata } from 'next'
import { RoutingMonitor } from '../page'

export const metadata: Metadata = { title: 'Pending Approval' }

export default async function PendingApprovalPage() {
  return <RoutingMonitor mode="pending" />
}
