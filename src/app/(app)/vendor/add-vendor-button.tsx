'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createVendor } from './actions'
import { VendorForm } from './vendor-form'

/** Top-right "Add Data" trigger + popup form. createVendor redirects on
 *  success, which navigates away and closes this modal on its own. */
export function AddVendorButton() {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Tambah vendor"
      description="Team dan anggota ditambahkan setelah vendor tersimpan."
      trigger={
        <Button type="button">
          <Plus size={16} aria-hidden />
          Add Data
        </Button>
      }
    >
      <VendorForm action={createVendor} submitLabel="Simpan vendor" />
    </Modal>
  )
}
