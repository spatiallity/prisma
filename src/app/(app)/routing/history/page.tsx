import type { Metadata } from 'next'
import { RoutingMonitor } from '../page'

export const metadata: Metadata = { title: 'Routing History' }

export default async function RoutingHistoryPage() {
  return <RoutingMonitor mode="history" />
}
