import type { Metadata } from 'next'
import { FinanceCategoryList } from '../finance-category-list'

export const metadata: Metadata = { title: 'PPBJ Jasa' }

export default function PpbjJasaPage() {
  return <FinanceCategoryList kategori="ppbj_jasa" />
}
