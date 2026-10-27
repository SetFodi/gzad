// Client CSV report: one row per (Tbilisi hour, screen) with the plays that
// screen logged and what the hour was charged. Plays come from play_logs and
// charges from billing_logs; both are limited to the signed-in client by RLS.

const TZ = 'Asia/Tbilisi'

export interface ReportPlayLog {
  began_at: string
  device_id: string | null
  duration_seconds: number | null
}

export interface ReportCharge {
  period_start: string
  device_id: string
  district: string | null
  total_cost: number | string | null
}

export interface ReportRow {
  date: string
  hour: string
  screen: string
  plays: number
  airtimeSeconds: number
  district: string
  cost: number
}

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })

function tbilisiHour(iso: string): { date: string; hour: string } {
  const d = new Date(iso)
  return { date: dateFmt.format(d), hour: `${hourFmt.format(d)}:00` }
}

/** [from, to) as ISO timestamps for whole Tbilisi days (UTC+4, no DST). */
export function tbilisiDayRange(firstDay: string, lastDay: string): { from: string; to: string } {
  const from = new Date(`${firstDay}T00:00:00+04:00`)
  const to = new Date(`${lastDay}T00:00:00+04:00`)
  to.setUTCDate(to.getUTCDate() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function buildReportRows(plays: ReportPlayLog[], charges: ReportCharge[]): ReportRow[] {
  const rows = new Map<string, ReportRow & { districtCost: Map<string, number> }>()
  const rowFor = (iso: string, screen: string) => {
    const { date, hour } = tbilisiHour(iso)
    const key = `${date}|${hour}|${screen}`
    let row = rows.get(key)
    if (!row) {
      row = { date, hour, screen, plays: 0, airtimeSeconds: 0, district: '', cost: 0, districtCost: new Map() }
      rows.set(key, row)
    }
    return row
  }

  for (const log of plays) {
    const row = rowFor(log.began_at, log.device_id ?? '')
    row.plays++
    row.airtimeSeconds += log.duration_seconds ?? 0
  }
  for (const charge of charges) {
    const row = rowFor(charge.period_start, charge.device_id)
    const cost = Number(charge.total_cost) || 0
    row.cost += cost
    if (charge.district) row.districtCost.set(charge.district, (row.districtCost.get(charge.district) ?? 0) + cost)
  }

  return [...rows.values()]
    .map(({ districtCost, ...row }) => {
      // Ten-minute blocks in one hour can fall in different districts: name
      // the one that was charged the most.
      let best = ''
      let bestCost = -1
      for (const [district, cost] of districtCost) {
        if (cost > bestCost) { best = district; bestCost = cost }
      }
      return { ...row, district: best }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour.localeCompare(b.hour) || a.screen.localeCompare(b.screen))
}

function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value)
  // Stop spreadsheet apps from reading a text cell as a formula.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export interface ReportHeaders {
  date: string
  hour: string
  screen: string
  plays: string
  airtime: string
  district: string
  cost: string
}

/** CSV with a BOM so Excel opens the Georgian headers as UTF-8. */
export function reportToCsv(rows: ReportRow[], headers: ReportHeaders): string {
  const lines = [
    [headers.date, headers.hour, headers.screen, headers.plays, headers.airtime, headers.district, headers.cost],
    ...rows.map(r => [r.date, r.hour, r.screen, r.plays, r.airtimeSeconds, r.district, r.cost.toFixed(2)]),
  ]
  return '﻿' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
