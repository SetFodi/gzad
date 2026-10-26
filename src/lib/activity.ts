import type { EventSeverity } from './system-events'

// Turns the rows behind the admin Activity page into one timeline. Pure, so
// the wording is tested without a database. Text goes through `t` (the admin
// dictionary); events are re-worded from their stored detail, so their titles
// follow the admin's language rather than the English saved with the row.

type Translate = (en: string, vars?: Record<string, string | number>) => string

const english: Translate = (en, vars) =>
  Object.entries(vars ?? {}).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), en)

export type ActivityCategory = 'screen' | 'billing' | 'campaign' | 'balance' | 'alert'

export interface ActivityItem {
  id: string
  at: string
  category: ActivityCategory
  severity: EventSeverity
  title: string
  /** system_events kind, for events. */
  kind?: string
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

/** "3 h 20 min", "45 min", "12 s"; mirrors formatDuration in system-events. */
function duration(seconds: number, t: Translate): string {
  if (seconds < 60) return t('{n} s', { n: Math.round(seconds) })
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t('{n} min', { n: minutes })
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 48) return m ? t('{h} h {m} min', { h, m }) : t('{n} h', { n: h })
  return t('{n} days', { n: Math.round(h / 24) })
}

const count = (n: number, one: string, many: string, t: Translate) => (n === 1 ? t(one) : t(many, { n }))

/** The event's title in the admin's language, or null to keep the stored one. */
function eventTitle(e: EventRow, t: Translate): string | null {
  const d = e.detail ?? {}
  const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0)
  const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).length : 0)
  const id = e.device_id ?? ''
  switch (e.kind) {
    case 'billing_run': {
      if (typeof d.charged !== 'number') return null
      const parts = [num('charged') > 0 ? t('₾{amount} charged', { amount: num('charged').toFixed(2) }) : t('nothing to charge')]
      if (list('paused')) parts.push(count(list('paused'), '1 campaign paused', '{n} campaigns paused', t))
      if (list('completed')) parts.push(count(list('completed'), '1 campaign ended', '{n} campaigns ended', t))
      if (list('resumed')) parts.push(count(list('resumed'), '1 campaign back after daily cap', '{n} campaigns back after daily cap', t))
      if (num('failed_clients')) parts.push(count(num('failed_clients'), '1 client failed', '{n} clients failed', t))
      return t('Billing: {summary}', { summary: parts.join(', ') })
    }
    case 'billing_run_failed':
      return t('Billing run failed: {error}', { error: e.title.replace(/^Billing run failed: /, '') })
    case 'connected':
      return t('{id} connected', { id })
    case 'disconnected':
      return typeof d.connected_seconds === 'number'
        ? t('{id} disconnected after {time} online', { id, time: duration(d.connected_seconds, t) })
        : t('{id} disconnected', { id })
    case 'restarted':
      return t('{id} restarted', { id })
    case 'setup_failed':
      return t('{id}: setting up play reporting failed', { id })
    case 'playlist_failed':
      return t('{id}: playlist push failed', { id })
    case 'playlist_skipped':
      return t('{id}: playlist not pushed ({reason})', { id, reason: typeof d.reason === 'string' ? d.reason : t('nothing to do') })
    case 'playlist_pushed':
      if (d.cleared) return t('{id}: screen cleared, no live campaigns', { id })
      if (typeof d.campaigns !== 'number' || typeof d.media !== 'number') return null
      return t('{id}: playlist pushed, {campaigns}, {files}', {
        id,
        campaigns: count(num('campaigns'), '1 campaign', '{n} campaigns', t),
        files: count(num('media'), '1 file', '{n} files', t),
      })
    default:
      return null
  }
}

function fromEvent(e: EventRow, t: Translate): ActivityItem {
  const d = e.detail ?? {}
  const detail: [string, string][] = []
  const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : null)

  if (e.kind === 'billing_run' || e.kind === 'billing_run_failed') {
    if (typeof d.mode === 'string') detail.push([t('Mode'), d.mode === 'metered' ? t('10-minute blocks') : d.mode === 'hourly' ? t('Whole hours') : d.mode])
    const charges = Array.isArray(d.charges) ? (d.charges as { client: string; charged: number; balance: number }[]) : []
    for (const c of charges) detail.push([t('Charged {client}', { client: c.client }), t('{amount}, balance now {balance}', { amount: gel(c.charged), balance: gel(c.balance) })])
    const paused = Array.isArray(d.paused) ? (d.paused as { campaign: string; client: string; reason: string }[]) : []
    for (const p of paused) detail.push([t('Paused {campaign}', { campaign: p.campaign }), `${p.client}, ${p.reason === 'cap' ? t('daily cap reached') : t('out of balance')}`])
    for (const name of Array.isArray(d.completed) ? (d.completed as string[]) : []) detail.push([t('Ended {campaign}', { campaign: name }), t('end date passed')])
    for (const name of Array.isArray(d.resumed) ? (d.resumed as string[]) : []) detail.push([t('Back on air {campaign}', { campaign: name }), t('new day after daily cap')])
    if (num('blocks')) detail.push([t('Blocks priced'), String(num('blocks')) + (num('late_blocks') ? `, ${t('{n} from late uploads', { n: num('late_blocks')! })}` : '')])
    if (num('devices_synced')) detail.push([t('Screens updated'), String(num('devices_synced'))])
    if (num('failed_clients')) detail.push([t('Failed clients'), String(num('failed_clients'))])
    if (num('duration_ms') !== null) detail.push([t('Took'), t('{n} s', { n: ((num('duration_ms') ?? 0) / 1000).toFixed(1) })])
  } else {
    if (num('offline_seconds') !== null) detail.push([t('Was offline for'), duration(num('offline_seconds')!, t)])
    if (num('connected_seconds') !== null) detail.push([t('Was online for'), duration(num('connected_seconds')!, t)])
    if (typeof d.ip === 'string') detail.push([t('Network address'), d.ip.replace(/^::ffff:/, '')])
    if (num('campaigns') !== null && num('media') !== null) detail.push([t('Playlist'), t('{campaigns} campaigns, {files} files', { campaigns: num('campaigns')!, files: num('media')! })])
    if (typeof d.reason === 'string') detail.push([t('Reason'), d.reason])
    if (typeof d.error === 'string') detail.push([t('Error'), d.error])
    if (Array.isArray(d.errors)) detail.push([t('Errors'), (d.errors as string[]).join('; ')])
  }
  const title = eventTitle(e, t) ?? e.title

  const category: ActivityCategory = e.category === 'screen' ? 'screen' : 'billing'
  return {
    id: `e${e.id}`,
    at: e.occurred_at,
    category,
    severity: e.severity,
    title,
    kind: e.kind,
    href: e.device_id ? '/admin/devices' : e.category === 'billing' ? '/admin/pricing' : undefined,
    detail,
    quiet: e.kind === 'billing_run' && e.severity === 'info',
    deviceId: e.device_id,
    searchText: `${title} ${e.title} ${e.device_id ?? ''} ${detail.map((p) => p.join(' ')).join(' ')}`.toLowerCase(),
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
function fromStatus(row: StatusRow, previous: string | undefined, t: Translate): ActivityItem {
  const [baseText, severity] = STATUS_TEXT[row.status] ?? [null, 'info' as EventSeverity]
  let text = baseText ? t(baseText) : t('status {status}', { status: row.status.replace(/_/g, ' ') })
  if (row.status === 'active' && previous === 'pending_review') text = t('approved and live')
  if (row.status === 'active' && !previous) text = t('created and live')
  const name = row.campaign ?? t('Campaign')
  const detail: [string, string][] = []
  if (previous) {
    const before = STATUS_TEXT[previous]?.[0]
    detail.push([t('Before'), (before ? t(before) : previous).replace(/^./, (c) => c.toUpperCase())])
  }
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

function fromTransaction(tx: TransactionRow, t: Translate): ActivityItem {
  const who = tx.client ?? t('Client')
  const amount = Number(tx.amount)
  const [title, severity, category]: [string, EventSeverity, ActivityCategory] =
    tx.type === 'topup' ? [t('{who} topped up {amount}', { who, amount: gel(amount) }), 'success', 'balance']
      : tx.type === 'refund' ? [t('{who} refunded {amount}', { who, amount: gel(amount) }), 'success', 'balance']
        : tx.type === 'billing' ? [t('{who} charged {amount} for airtime', { who, amount: gel(-amount) }), 'info', 'billing']
          : [amount >= 0
            ? t('{who} balance credited {amount}', { who, amount: gel(amount) })
            : t('{who} balance reduced {amount}', { who, amount: gel(-amount) }), 'info', 'balance']
  const detail: [string, string][] = []
  if (tx.balance_after !== null) detail.push([t('Balance after'), gel(Number(tx.balance_after))])
  if (tx.note) detail.push([t('Note'), tx.note])
  if (tx.actor) detail.push([t('By'), tx.actor])
  return {
    id: `t${tx.id}`,
    at: tx.created_at,
    category,
    severity,
    title,
    href: `/admin/clients/${tx.client_id}`,
    detail,
    amount: tx.type === 'billing' ? -amount : amount,
    searchText: `${title} ${tx.note ?? ''} ${tx.actor ?? ''}`.toLowerCase(),
  }
}

const ALERT_TEXT: Record<string, string> = {
  low_20pct: 'balance below 20% of the last top-up',
  runway_1d: 'about a day of airtime left',
  depleted: 'balance used up, ads paused',
  cap_reached: 'daily cap reached',
}

function fromAlert(a: AlertRow, t: Translate): ActivityItem {
  const who = a.client ?? t('Client')
  const text = ALERT_TEXT[a.kind] ? t(ALERT_TEXT[a.kind]) : a.kind.replace(/_/g, ' ')
  const detail: [string, string][] = []
  if (a.balance !== null) detail.push([t('Balance'), gel(Number(a.balance))])
  if (a.campaign) detail.push([t('Campaign'), a.campaign])
  detail.push([t('Email'), a.sent_at ? t('Sent') : t('Not sent')])
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
}, t: Translate = english): ActivityItem[] {
  // Prior status per change: walk each campaign's history oldest first.
  const ordered = [...input.statuses].sort((a, b) => a.changed_at.localeCompare(b.changed_at) || a.id - b.id)
  const lastStatus = new Map<string, string>()
  const statusItems = ordered.map((row) => {
    const item = fromStatus(row, lastStatus.get(row.campaign_id), t)
    lastStatus.set(row.campaign_id, row.status)
    return item
  })

  return [
    ...input.events.map((e) => fromEvent(e, t)),
    ...statusItems,
    ...input.transactions.map((tx) => fromTransaction(tx, t)),
    ...input.alerts.map((a) => fromAlert(a, t)),
  ].sort((a, b) => b.at.localeCompare(a.at))
}
