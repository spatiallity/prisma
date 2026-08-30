import type { Metadata } from 'next'
import { FinanceCategoryList } from '../finance-category-list'

export const metadata: Metadata = { title: 'Gaji PTT Project' }

export default function GajiPttPage() {
  return <FinanceCategoryList kategori="gaji_ptt" />
}
