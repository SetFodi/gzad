import { describe, expect, it } from 'vitest'
import { buildReportRows, reportToCsv, tbilisiDayRange } from './campaign-report'

const headers = { date: 'Date', hour: 'Hour', screen: 'Screen', plays: 'Plays', airtime: 'Airtime (s)', district: 'District', cost: 'Cost (GEL)' }

describe('campaign report', () => {
  it('covers whole Tbilisi days', () => {
    expect(tbilisiDayRange('2026-10-20', '2026-10-21')).toEqual({
      from: '2026-10-19T20:00:00.000Z',
      to: '2026-10-21T20:00:00.000Z',
    })
  })

  it('joins plays and charges per Tbilisi hour and screen', () => {
    const rows = buildReportRows(
      [
        { began_at: '2026-10-20T06:05:00Z', device_id: 'screen-a', duration_seconds: 10 },
        { began_at: '2026-10-20T06:55:00Z', device_id: 'screen-a', duration_seconds: 10 },
        { began_at: '2026-10-20T06:10:00Z', device_id: 'screen-b', duration_seconds: 20 },
      ],
      [
        { period_start: '2026-10-20T06:00:00Z', device_id: 'screen-a', district: 'Vake', total_cost: '0.120000' },
        { period_start: '2026-10-20T06:10:00Z', device_id: 'screen-a', district: 'Saburtalo', total_cost: '0.300000' },
        { period_start: '2026-10-20T06:20:00Z', device_id: 'screen-a', district: 'Vake', total_cost: '0.100000' },
        // Charged, but no play reported in that hour.
        { period_start: '2026-10-20T19:50:00Z', device_id: 'screen-b', district: 'Isani', total_cost: 0.05 },
      ],
    )

    expect(rows).toEqual([
      { date: '2026-10-20', hour: '10:00', screen: 'screen-a', plays: 2, airtimeSeconds: 20, district: 'Saburtalo', cost: 0.52 },
      { date: '2026-10-20', hour: '10:00', screen: 'screen-b', plays: 1, airtimeSeconds: 20, district: '', cost: 0 },
      { date: '2026-10-20', hour: '23:00', screen: 'screen-b', plays: 0, airtimeSeconds: 0, district: 'Isani', cost: 0.05 },
    ])
  })

  it('writes a UTF-8 CSV that spreadsheets cannot run as formulas', () => {
    const csv = reportToCsv(
      [{ date: '2026-10-20', hour: '10:00', screen: '=HYPERLINK("x")', plays: 3, airtimeSeconds: 30, district: 'Vake, Upper', cost: 0.125 }],
      { ...headers, date: 'თარიღი' },
    )

    expect(csv).toBe(
      '﻿თარიღი,Hour,Screen,Plays,Airtime (s),District,Cost (GEL)\r\n'
      + `2026-10-20,10:00,"'=HYPERLINK(""x"")",3,30,"Vake, Upper",0.13\r\n`,
    )
  })
})
