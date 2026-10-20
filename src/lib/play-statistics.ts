export interface CampaignPlayLog {
  began_at: string
  duration_seconds: number | null
  device_id: string | null
}

export interface DailyPlayStatistics {
  date: string
  play_count: number
  total_duration_seconds: number
  unique_taxis: number
  km_covered: number | null
}

/** Daily campaign totals from the actual play records, in Tbilisi time. */
export function aggregateCampaignPlays(logs: CampaignPlayLog[]): DailyPlayStatistics[] {
  const byDate: Record<string, { plays: number; duration: number; devices: Set<string> }> = {}
  for (const log of logs) {
    const date = new Date(log.began_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })
    if (!byDate[date]) byDate[date] = { plays: 0, duration: 0, devices: new Set() }
    byDate[date].plays++
    byDate[date].duration += log.duration_seconds || 0
    if (log.device_id) byDate[date].devices.add(log.device_id)
  }
  return Object.entries(byDate)
    .map(([date, d]) => ({
      date,
      play_count: d.plays,
      total_duration_seconds: d.duration,
      unique_taxis: d.devices.size,
      // A play's coordinates do not establish how far its screen travelled.
      km_covered: null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
