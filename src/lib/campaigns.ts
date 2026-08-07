// Campaign scheduling window helpers.
//
// A campaign only airs (and only bills) while today's Tbilisi date falls inside
// its [start_date, end_date] window. NULL on either side means "open ended".
// Every place that decides "is this campaign live right now" must go through
// here so the playlist, the admin slot view, and billing can never disagree.

export const TZ = 'Asia/Tbilisi'

/** Today's date in Tbilisi as YYYY-MM-DD. */
export function tbilisiToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** The hour of day (0-23) in Tbilisi for a given instant. */
export function tbilisiHour(at: Date): number {
  return parseInt(
    at.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }),
    10,
  )
}

interface OrFilterable {
  or(filters: string): this
}

/**
 * Narrows a campaigns query to those inside their date window.
 * Chained `.or()` calls are ANDed together by PostgREST, so this reads as
 * (start is null OR start <= today) AND (end is null OR end >= today).
 */
export function applyLiveWindow<Q extends OrFilterable>(query: Q, today: string = tbilisiToday()): Q {
  return query
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
}

/** In-memory equivalent of applyLiveWindow, for rows already fetched. */
export function isWithinWindow(
  campaign: { start_date?: string | null; end_date?: string | null },
  today: string = tbilisiToday(),
): boolean {
  if (campaign.start_date && campaign.start_date > today) return false
  if (campaign.end_date && campaign.end_date < today) return false
  return true
}
