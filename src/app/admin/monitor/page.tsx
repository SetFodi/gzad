'use client'

import LiveWall from '@/components/admin/live/LiveWall'
import { apiSource } from '@/components/admin/live/data-source'

export default function LiveViewPage() {
  return <LiveWall source={apiSource} />
}
