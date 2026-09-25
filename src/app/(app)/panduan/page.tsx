import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { GuideBrowser } from './guide-browser'
import { SCREENSHOT_ACCESS, TOPICS } from './guide-data'

export const metadata: Metadata = { title: 'Panduan' }

export default async function PanduanPage() {
  const user = await requireUser()
  const topics = TOPICS
    .filter((topic) => can(user.permissions, topic.module, 'view'))
    .map((topic) => {
      const imageName = topic.image?.split('/').at(-1) ?? ''
      const imageAllowed = SCREENSHOT_ACCESS[imageName]?.some((module) => can(user.permissions, module, 'view'))
      return { ...topic, image: imageAllowed ? topic.image : null }
    })
  return <GuideBrowser topics={topics} />
}
