import { redirect } from 'next/navigation'

/** Section 7 submenu — the queue itself carries the stage filter. */
export default function DesignStageShortcut() {
  redirect('/design?stage=final')
}
