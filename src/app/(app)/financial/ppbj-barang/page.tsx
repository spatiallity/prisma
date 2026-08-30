import type { Metadata } from 'next'
import { FinanceCategoryList } from '../finance-category-list'

export const metadata: Metadata = { title: 'PPBJ Barang' }

export default function PpbjBarangPage() {
  return <FinanceCategoryList kategori="ppbj_barang" />
}
