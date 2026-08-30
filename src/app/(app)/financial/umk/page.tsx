import type { Metadata } from 'next'
import { FinanceCategoryList } from '../finance-category-list'

export const metadata: Metadata = { title: 'UMK' }

export default function UmkPage() {
  return <FinanceCategoryList kategori="umk" />
}
