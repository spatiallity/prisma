/**
 * Server Actions reset a `<form>`'s uncontrolled inputs once the action
 * returns — even on a validation error, even though the page never
 * navigates away. Every action that can return `{ error }` after some
 * required fields already passed should echo the submission back via
 * this, so the client can restore what the user typed (see
 * useRestoreFormValues, components/ui/field.tsx).
 */
export function pickFormValues(formData: FormData, exclude: string[] = []): Record<string, string> {
  const skip = new Set(['password', ...exclude])
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !skip.has(key)) out[key] = value
  }
  return out
}
