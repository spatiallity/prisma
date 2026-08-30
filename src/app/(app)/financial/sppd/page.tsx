import type { Metadata } from 'next'
import { FinanceCategoryList } from '../finance-category-list'

export const metadata: Metadata = { title: 'SPPD' }

export default function SppdPage() {
  return <FinanceCategoryList kategori="sppd" />
}
