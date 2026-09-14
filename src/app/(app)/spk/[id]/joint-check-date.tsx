'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Save } from 'lucide-react'
import { useActionToast } from '@/components/ui/toast'
import { setJointCheckDate, type SpkFormState } from '../actions'

const initialState: SpkFormState = { error: null }

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Save size={14} aria-hidden />
      {pending ? 'Menyimpan…' : 'Simpan'}
    </button>
  )
}

/** Pengecekan Bersama — tanggal pelaksanaan, tidak seperti Opname/PAD ini bukan mark tapi tanggal yang bisa diubah. */
export function JointCheckDateRow({ spkId, date }: { spkId: string; date: string | null }) {
  const [state, formAction] = useActionState(setJointCheckDate, initialState)
  useActionToast(state)

  return (
    <form action={formAction} className="flex items-center justify-between gap-3 py-2">
      <input type="hidden" name="id" value={spkId} />
      <span className="text-sm font-bold text-slate-900">Pengecekan Bersama</span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          name="joint_check_date"
          defaultValue={date ?? ''}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
        />
        <SaveButton />
      </div>
    </form>
  )
}
