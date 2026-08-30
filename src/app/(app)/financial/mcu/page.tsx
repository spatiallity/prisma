import type { Metadata } from 'next'
import { FinanceCategoryList } from '../finance-category-list'

export const metadata: Metadata = { title: 'MCU' }

export default function McuPage() {
  return <FinanceCategoryList kategori="mcu" />
}
