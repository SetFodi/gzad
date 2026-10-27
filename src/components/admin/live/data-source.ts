import type { Connection, LiveProgram, PlayReport, ProgramReason } from '@/lib/live-view'

// Where the live view gets its data. The page uses the admin API; keeping it
// behind an interface lets the wall run against sample data too.

export interface CatalogDevice {
  id: string
  name: string | null
  groupId: string | null
  plate: string | null
  online: boolean
  lastSeen: string | null
}

export interface CatalogGroup {
  id: string
  name: string
}

export interface Catalog {
  devices: CatalogDevice[]
  groups: CatalogGroup[]
  realtimeError?: string
}

export interface Feed {
  /** Server clock when the reports were read, to correct the browser's clock. */
  serverTime: number
  reports: Record<string, PlayReport[]>
  /** Absent when the Realtime Server couldn't be asked. */
  connections?: Record<string, Connection>
}

export interface ProgramResult {
  serverTime: number
  program: LiveProgram | null
  /** Set when the program didn't come from the screen itself. */
  reason?: ProgramReason
}

export interface LiveDataSource {
  catalog(): Promise<Catalog>
  feed(ids: string[]): Promise<Feed>
  program(id: string): Promise<ProgramResult>
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.json() as Promise<T>
}

export const apiSource: LiveDataSource = {
  catalog: () => getJson<Catalog>('/api/admin/monitor'),
  feed: (ids) => getJson<Feed>(`/api/admin/monitor/feed?devices=${encodeURIComponent(ids.join(','))}`),
  program: (id) => getJson<ProgramResult>(`/api/admin/monitor/program?device=${encodeURIComponent(id)}`),
}
