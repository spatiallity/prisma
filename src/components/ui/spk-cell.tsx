import Link from 'next/link'

/**
 * The SPK identity every list in the app should render the same way: the
 * site_code shortname is what a reader recognizes (e.g. "FL BKB-STO.04"),
 * the full spk_number is the fine print underneath — same precedence as the
 * Detail SPK header itself.
 */
export function SpkCell({
  id,
  spkNumber,
  siteCode,
  href,
}: {
  id: string
  spkNumber: string
  siteCode: string | null
  href?: string
}) {
  return (
    <>
      <Link href={href ?? `/spk/${id}`} className="font-bold text-primary hover:underline">
        {siteCode ?? spkNumber}
      </Link>
      {siteCode && <div className="text-xs font-semibold text-slate-500">{spkNumber}</div>}
    </>
  )
}
