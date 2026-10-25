import { formatDuration, type EventSeverity } from './system-events'

// Turns the rows behind the admin Activity page into one timeline. Pure, so
// the wording is tested without a database.

export type ActivityCategory = 'screen' | 'billing' | 'campaign' | 'balance' | 'alert'

export interface ActivityItem {
  id: string
  at: string
  category: ActivityCategory
  severity: EventSeverity
  title: string
  subtitle?: string
  href?: string
  detail: [string, string][]
  /** Routine entries (billing runs that charged nothing) hidden by default. */
  quiet?: boolean
  deviceId?: string | null
  /** Lari moved, for billing and balance entries (charges are positive). */
  amount?: number
  searchText: string
}

export interface EventRow {
  id: number
  occurred_at: string
  category: string
  kind: string
  severity: EventSeverity
  title: string
  device_id: string | null
  client_id: string | null
  campaign_id: string | null
  detail: Record<string, unknown> | null
}

export interface StatusRow {
  id: number
  campaign_id: string
  status: string
  changed_at: string
  campaign: string | null
  client: string | null
}

export interface TransactionRow {
  id: string
  created_at: string
  client_id: string
  amount: number
  balance_after: number | null
  type: string
  note: string | null
  client: string | null
  actor: string | null
}

export interface AlertRow {
  id: string
  created_at: string
  kind: string
  balance: number | null
  sent_at: string | null
  client_id: string
  client: string | null
  campaign: string | null
}

const gel = (n: number) => `${n < 0 ? '−' : ''}₾${Math.abs(n).toFixed(2)}`

function fromEvent(e: EventRow): ActivityItem {
  const d = e.detail ?? {}
  const detail: [string, string][] = []
  const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : null)

  if (e.kind === 'billing_run' || e.kind === 'billing_run_failed') {
    if (typeof d.mode === 'string') detail.push(['Mode', d.mode === 'metered' ? '10-minute blocks' : d.mode === 'hourly' ? 'Whole hours' : d.mode])
    const charges = Array.isArray(d.charges) ? (d.charges as { client: string; charged: number; balance: number }[]) : []
    for (const c of charges) detail.push([`Charged ${c.client}`, `${gel(c.charged)}, balance now ${gel(c.balance)}`])
    const paused = Array.isArray(d.paused) ? (d.paused as { campaign: string; client: string; reason: string }[]) : []
    for (const p of paused) detail.push([`Paused ${p.campaign}`, `${p.client}, ${p.reason === 'cap' ? 'daily cap reached' : 'out of balance'}`])
    for (const name of Array.isArray(d.completed) ? (d.completed as string[]) : []) detail.push([`Ended ${name}`, 'end date passed'])
    for (const name of Array.isArray(d.resumed) ? (d.resumed as string[]) : []) detail.push([`Back on air ${name}`, 'new day after daily cap'])
    if (num('blocks')) detail.push(['Blocks priced', String(num('blocks')) + (num('late_blocks') ? `, ${num('late_blocks')} from late uploads` : '')])
    if (num('devices_synced')) detail.push(['Screens updated', String(num('devices_synced'))])
    if (num('failed_clients')) detail.push(['Failed clients', String(num('failed_clients'))])
    if (num('duration_ms') !== null) detail.push(['Took', `${((num('duration_ms') ?? 0) / 1000).toFixed(1)} s`])
  } else {
    if (num('offline_seconds') !== null) detail.push(['Was offline for', formatDuration(num('offline_seconds')!)])
    if (num('connected_seconds') !== null) detail.push(['Was online for', formatDuration(num('connected_seconds')!)])
    if (typeof d.ip === 'string') detail.push(['Network address', d.ip.replace(/^::ffff:/, '')])
    if (num('campaigns') !== null && num('media') !== null) detail.push(['Playlist', `${num('campaigns')} campaigns, ${num('media')} files`])
    if (typeof d.reason === 'string') detail.push(['Reason', d.reason])
    if (typeof d.error === 'string') detail.push(['Error', d.error])
    if (Array.isArray(d.errors)) detail.push(['Errors', (d.errors as string[]).join('; ')])
  }

  const category: ActivityCategory = e.category === 'screen' ? 'screen' : 'billing'
  return {
    id: `e${e.id}`,
    at: e.occurred_at,
    category,
    severity: e.severity,
    title: e.title,
    href: e.device_id ? '/admin/devices' : e.category === 'billing' ? '/admin/pricing' : undefined,
    detail,
    quiet: e.kind === 'billing_run' && e.severity === 'info',
    deviceId: e.device_id,
    searchText: `${e.title} ${e.device_id ?? ''} ${detail.map((p) => p.join(' ')).join(' ')}`.toLowerCase(),
  }
}

const STATUS_TEXT: Record<string, [string, EventSeverity]> = {
  active: ['back on air', 'success'],
  pending_review: ['submitted for review', 'info'],
  paused: ['paused', 'warning'],
  paused_billing: ['paused: out of balance', 'warning'],
  paused_cap: ['paused: daily cap reached', 'warning'],
  completed: ['ended', 'info'],
  draft: ['saved as a draft', 'info'],
}

/** `rows` newest first; `previous` is each change's prior status where known. */
function fromStatus(row: StatusRow, previous: string | undefined): ActivityItem {
  const [baseText, severity] = STATUS_TEXT[row.status] ?? [`status ${row.status.replace(/_/g, ' ')}`, 'info' as EventSeverity]
  let text = baseText
  if (row.status === 'active' && previous === 'pending_review') text = 'approved and live'
  if (row.status === 'active' && !previous) text = 'created and live'
  const name = row.campaign ?? 'Campaign'
  const detail: [string, string][] = []
  if (previous) detail.push(['Before', (STATUS_TEXT[previous]?.[0] ?? previous).replace(/^./, (c) => c.toUpperCase())])
  return {
    id: `s${row.id}`,
    at: row.changed_at,
    category: 'campaign',
    severity,
    title: `${name} ${text}`,
    subtitle: row.client ?? undefined,
    href: `/admin/campaigns/${row.campaign_id}`,
    detail,
    searchText: `${name} ${text} ${row.client ?? ''}`.toLowerCase(),
  }
}

function fromTransaction(t: TransactionRow): ActivityItem {
  const who = t.client ?? 'Client'
  const amount = Number(t.amount)
  const [title, severity, category]: [string, EventSeverity, ActivityCategory] =
    t.type === 'topup' ? [`${who} topped up ${gel(amount)}`, 'success', 'balance']
      : t.type === 'refund' ? [`${who} refunded ${gel(amount)}`, 'success', 'balance']
        : t.type === 'billing' ? [`${who} charged ${gel(-amount)} for airtime`, 'info', 'billing']
          : [`${who} balance ${amount >= 0 ? 'credited' : 'reduced'} ${gel(Math.abs(amount))}`, 'info', 'balance']
  const detail: [string, string][] = []
  if (t.balance_after !== null) detail.push(['Balance after', gel(Number(t.balance_after))])
  if (t.note) detail.push(['Note', t.note])
  if (t.actor) detail.push(['By', t.actor])
  return {
    id: `t${t.id}`,
    at: t.created_at,
    category,
    severity,
    title,
    href: `/admin/clients/${t.client_id}`,
    detail,
    amount: t.type === 'billing' ? -amount : amount,
    searchText: `${title} ${t.note ?? ''} ${t.actor ?? ''}`.toLowerCase(),
  }
}

const ALERT_TEXT: Record<string, string> = {
  low_20pct: 'balance below 20% of the last top-up',
  runway_1d: 'about a day of airtime left',
  depleted: 'balance used up, ads paused',
  cap_reached: 'daily cap reached',
}

function fromAlert(a: AlertRow): ActivityItem {
  const who = a.client ?? 'Client'
  const text = ALERT_TEXT[a.kind] ?? a.kind.replace(/_/g, ' ')
  const detail: [string, string][] = []
  if (a.balance !== null) detail.push(['Balance', gel(Number(a.balance))])
  if (a.campaign) detail.push(['Campaign', a.campaign])
  detail.push(['Email', a.sent_at ? 'Sent' : 'Not sent'])
  return {
    id: `a${a.id}`,
    at: a.created_at,
    category: 'alert',
    severity: a.kind === 'depleted' ? 'error' : 'warning',
    title: `${who}: ${text}`,
    href: `/admin/clients/${a.client_id}`,
    detail,
    searchText: `${who} ${text} ${a.campaign ?? ''}`.toLowerCase(),
  }
}

export function buildActivity(input: {
  events: EventRow[]
  statuses: StatusRow[]
  transactions: TransactionRow[]
  alerts: AlertRow[]
}): ActivityItem[] {
  // Prior status per change: walk each campaign's history oldest first.
  const ordered = [...input.statuses].sort((a, b) => a.changed_at.localeCompare(b.changed_at) || a.id - b.id)
  const lastStatus = new Map<string, string>()
  const statusItems = ordered.map((row) => {
    const item = fromStatus(row, lastStatus.get(row.campaign_id))
    lastStatus.set(row.campaign_id, row.status)
    return item
  })

  return [
    ...input.events.map(fromEvent),
    ...statusItems,
    ...input.transactions.map(fromTransaction),
    ...input.alerts.map(fromAlert),
  ].sort((a, b) => b.at.localeCompare(a.at))
}
