'use client'

import NumberFlow from '@number-flow/react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useLandingReducedMotion } from './useLandingReducedMotion'
import { useEffect, useReducer, useRef, useState } from 'react'
import { DEFAULT_BASE_RATES, money, parsePricingConfig } from '@/lib/billing'
import { CONTACT, type Copy } from './copy'
import { EASE, Reveal, rich } from './Reveal'
import { TILES, gridArea, tileByName, tileCorner, type Tier } from './tiles'

// The agreed billing model (docs/billing-metering-plan.md): airtime is metered in
// 10-minute blocks — base rate ÷ 6 × district × time of day × share actually
// played — and the balance is drawn down every 15 minutes, with an optional
// daily cap. District multipliers are the billing defaults; time-of-day bands
// match the admin pricing page; each district's tier here is an example.
const { districtMultipliers } = parsePricingConfig(null)

export type BandKey = 'night' | 'day' | 'evening' | 'rush'
const BAND_MULT: Record<BandKey, number> = { night: 0.75, day: 1.0, evening: 1.15, rush: 1.3 }
const BANDS: { key: BandKey; from: number; to: number }[] = [
  { key: 'evening', from: 0, to: 60 },
  { key: 'night', from: 60, to: 420 },
  { key: 'rush', from: 420, to: 600 },
  { key: 'day', from: 600, to: 1020 },
  { key: 'rush', from: 1020, to: 1200 },
  { key: 'evening', from: 1200, to: 1440 },
]
const bandAt = (minute: number) => BANDS.find((b) => minute >= b.from && minute < b.to)!.key

// One car's day, block by block: [district, share of the block the ad played].
// The 0.5 / 0 / 0.7 blocks are the taxi stopping, switching off and restarting.
const DAY: [string, number][] = [
  ['Saburtalo', 1], ['Saburtalo', 1], ['Vake', 1], ['Vake', 1], ['Vake', 0.5], ['Vake', 0],
  ['Vake', 0.7], ['Mtatsminda', 1], ['Mtatsminda', 1], ['Chughureti', 1], ['Chughureti', 1], ['Didube', 1],
  ['Saburtalo', 1], ['Nadzaladevi', 1], ['Gldani', 1], ['Gldani', 1], ['Didube', 1], ['Chughureti', 1],
  ['Isani', 1], ['Samgori', 1], ['Isani', 1], ['Krtsanisi', 1], ['Mtatsminda', 1], ['Vake', 1],
]

const STEP_MIN = 5
const BLOCK_MIN = 10
const POST_EVERY_MIN = 15
const TICK_MS = 1100
const START_MIN = 6 * 60 + 30
const TOP_UPS = [500, 1000, 2500]
const CAPS = ['none', '20', '50']
const FORMATS = ['10', '20', '30']
const TIERS: Tier[] = ['1', '2', '3', '4']
const BAND_ORDER: BandKey[] = ['night', 'day', 'evening', 'rush']
const LOW_BALANCE_SHARE = 0.2

const exact = (n: number) => Math.round(n * 1e6) / 1e6
const hourlyRate = (format: string, district: string, minute: number) =>
  exact(DEFAULT_BASE_RATES[format] * districtMultipliers[tileByName[district].tier] * BAND_MULT[bandAt(minute)])

type BlockStatus = 'played' | 'partial' | 'off' | 'capped'

interface Block {
  id: number
  minute: number
  district: string
  band: BandKey
  share: number
  cost: number
  status: BlockStatus
}

interface Meter {
  minute: number
  blockN: number
  balance: number
  topUp: number
  pending: number
  carry: number
  today: number
  capped: boolean
  blocks: Block[]
  post: { id: number; amount: number } | null
}

type Action = { type: 'tick'; format: string; cap: number | null } | { type: 'topUp'; amount: number }

const fresh = (amount: number): Meter => ({
  minute: START_MIN,
  blockN: 0,
  balance: amount,
  topUp: amount,
  pending: 0,
  carry: 0,
  today: 0,
  capped: false,
  blocks: [],
  post: null,
})

function meter(m: Meter, action: Action): Meter {
  if (action.type === 'topUp') return fresh(action.amount)
  if (m.balance <= 0) return m

  const next = { ...m }
  const crossedMidnight = m.minute + STEP_MIN >= 1440
  next.minute = (m.minute + STEP_MIN) % 1440

  // A 10-minute block just finished: price it and add it to the metered total.
  if (next.minute % BLOCK_MIN === 0) {
    const start = (next.minute - BLOCK_MIN + 1440) % 1440
    const [district, share] = DAY[m.blockN % DAY.length]
    let cost = exact((hourlyRate(action.format, district, start) / 6) * share)
    let status: BlockStatus = share === 0 ? 'off' : share < 1 ? 'partial' : 'played'
    if (next.capped) {
      cost = 0
      status = 'capped'
    } else if (action.cap !== null) {
      cost = Math.min(cost, Math.max(0, action.cap - next.today))
      if (next.today + cost >= action.cap - 1e-9) next.capped = true
    }
    next.today = exact(next.today + cost)
    next.pending = exact(next.pending + cost)
    next.blockN = m.blockN + 1
    next.blocks = [
      { id: m.blockN, minute: start, district, band: bandAt(start), share, cost, status },
      ...m.blocks,
    ].slice(0, 4)
  }

  // Every 15 minutes the metered amount is posted to the balance, in whole tetri;
  // the remainder carries to the next post.
  if (next.minute % POST_EVERY_MIN === 0) {
    const amount = money(next.pending + next.carry)
    if (amount > 0) {
      next.carry = exact(next.pending + next.carry - amount)
      next.pending = 0
      next.balance = Math.max(0, money(next.balance - amount))
      next.post = { id: next.blockN * 1440 + next.minute, amount }
    }
  }

  // Tbilisi midnight: the block that just ended belonged to yesterday, so the
  // daily cap resets only now.
  if (crossedMidnight) {
    next.today = 0
    next.capped = false
  }
  return next
}

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const x = (n: number) => `×${n.toFixed(2)}`
const gel = (digits: number) =>
  ({
    style: 'currency',
    currency: 'GEL',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) as const

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="lp-field">
      <span className="lp-field-label">{label}</span>
      <div className="lp-seg" role="radiogroup" aria-label={label} data-count={options.length}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Pricing({ t }: { t: Copy }) {
  const p = t.pricing
  const s = p.sim
  const reduce = useLandingReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-15% 0px' })
  const [format, setFormat] = useState('20')
  const [capKey, setCapKey] = useState('20')
  const [playing, setPlaying] = useState<boolean | null>(null)
  const [m, dispatch] = useReducer(meter, 1000, fresh)
  const cap = capKey === 'none' ? null : Number(capKey)

  // Plays on its own unless the visitor prefers reduced motion or pressed pause.
  const on = playing ?? !reduce
  const running = on && inView && m.balance > 0

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => dispatch({ type: 'tick', format, cap }), TICK_MS)
    return () => window.clearInterval(id)
  }, [running, format, cap])

  // The block being metered right now.
  const [district, share] = DAY[m.blockN % DAY.length]
  const tile = tileByName[district]
  const blockStart = m.minute - (m.minute % BLOCK_MIN)
  const band = bandAt(blockStart)
  const rate = hourlyRate(format, district, blockStart)
  const nextPost = POST_EVERY_MIN - (m.minute % POST_EVERY_MIN)
  const car = tileCorner(tile)
  const name = (d: string) => t.where.districts[d] ?? d

  const statusLabel = (b: Block) =>
    b.status === 'off' ? s.off : b.status === 'capped' ? s.capped : `${Math.round(b.share * 100)}%`

  return (
    <section id="pricing" className="lp-section lp-alt lp-pricing">
      <div className="lp-wrap">
        <Reveal className="lp-head lp-head-center">
          <p className="lp-eyebrow">{p.eyebrow}</p>
          <h2 className="lp-title">{p.title}</h2>
          <p className="lp-lede">{rich(p.lede)}</p>
        </Reveal>

        <Reveal>
          <div ref={ref} className="lp-meter">
            <div className="lp-meter-top">
              <div className="lp-meter-balance">
                <p className="lp-field-label">{s.balance}</p>
                <div className="lp-meter-amount-row">
                  <p className="lp-meter-amount">
                    <NumberFlow value={m.balance} format={gel(2)} locales="en-US" />
                  </p>
                  <AnimatePresence>
                    {m.post && (
                      <motion.span
                        key={m.post.id}
                        className="lp-meter-posted"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      >
                        {s.deducted} −₾{m.post.amount.toFixed(2)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="lp-meter-track" aria-hidden>
                  <span style={{ transform: `scaleX(${m.balance / m.topUp})` }} />
                  <i style={{ left: `${LOW_BALANCE_SHARE * 100}%` }} />
                </div>
                <p className="lp-meter-alert-mark" style={{ paddingLeft: `${LOW_BALANCE_SHARE * 100}%` }}>
                  {s.lowAlert}
                </p>
                <p className="lp-meter-left" aria-live="polite">
                  {m.balance > 0 ? (
                    <>
                      {s.nextUpdate} {nextPost} {s.min} · ₾{m.pending.toFixed(2)} {s.metered}
                    </>
                  ) : (
                    s.empty
                  )}
                </p>
              </div>

              <div className="lp-meter-controls">
                <Segmented
                  label={s.adLength}
                  value={format}
                  onChange={setFormat}
                  options={FORMATS.map((f) => ({ value: f, label: `${f} ${t.loop.seconds}` }))}
                />
                <Segmented
                  label={s.cap}
                  value={capKey}
                  onChange={setCapKey}
                  options={CAPS.map((c) => ({ value: c, label: c === 'none' ? s.noCap : `₾${c}` }))}
                />
                <div className="lp-field">
                  <span className="lp-field-label">{s.topUp}</span>
                  <div className="lp-meter-topups">
                    {TOP_UPS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className="lp-chip"
                        aria-pressed={m.topUp === a}
                        onClick={() => dispatch({ type: 'topUp', amount: a })}
                      >
                        ₾{a.toLocaleString('en-US')}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="lp-meter-play"
                      aria-label={on ? s.pause : s.play}
                      onClick={() => setPlaying(!on)}
                    >
                      {on ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                          <rect x="2" y="1.5" width="2.6" height="9" rx="1" fill="currentColor" />
                          <rect x="7.4" y="1.5" width="2.6" height="9" rx="1" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                          <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l7-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-meter-body">
              <div className="lp-meter-city">
                <div className="lp-meter-map">
                  {TILES.map((d) => (
                    <div
                      key={d.name}
                      className="lp-meter-tile"
                      data-tier={d.tier}
                      data-current={d.name === district || undefined}
                      style={gridArea(d)}
                    >
                      <span>{name(d.name)}</span>
                      <em>{x(districtMultipliers[d.tier])}</em>
                    </div>
                  ))}
                  <span
                    className="lp-meter-car"
                    data-off={share === 0 || m.capped || undefined}
                    style={{ left: `calc(${car.x}% - 22px)`, top: `calc(${car.y}% + 22px)` }}
                    aria-hidden
                  />
                </div>
                <ul className="lp-meter-legend">
                  {TIERS.map((tier) => (
                    <li key={tier} data-tier={tier}>
                      <i />
                      {p.tiers[tier]} {x(districtMultipliers[tier])}
                    </li>
                  ))}
                </ul>

                <div className="lp-meter-day">
                  <div className="lp-meter-bands">
                    {BANDS.map((b) => (
                      <span
                        key={b.from}
                        data-band={b.key}
                        style={{ left: `${(b.from / 1440) * 100}%`, width: `${((b.to - b.from) / 1440) * 100}%` }}
                      />
                    ))}
                    <span className="lp-meter-now" style={{ left: `${(m.minute / 1440) * 100}%` }}>
                      <b>{clock(m.minute)}</b>
                    </span>
                  </div>
                  <div className="lp-meter-hours" aria-hidden>
                    <span>00</span>
                    <span>06</span>
                    <span>12</span>
                    <span>18</span>
                    <span>24</span>
                  </div>
                  <ul className="lp-meter-legend">
                    {BAND_ORDER.map((k) => (
                      <li key={k} data-band={k}>
                        <i />
                        {p.bands[k]} {x(BAND_MULT[k])}
                      </li>
                    ))}
                  </ul>
                </div>

                {cap !== null && (
                  <div className="lp-meter-cap" data-capped={m.capped || undefined}>
                    <p className="lp-field-label">
                      {m.capped ? s.capReached : `${s.today}: ₾${m.today.toFixed(2)} / ₾${cap.toFixed(2)}`}
                    </p>
                    <div className="lp-meter-captrack" aria-hidden>
                      <span style={{ transform: `scaleX(${Math.min(1, m.today / cap)})` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="lp-meter-panel">
                <p className="lp-field-label">
                  {s.now} · {clock(m.minute)}
                </p>
                <div className="lp-meter-formula">
                  <div>
                    <b>₾{DEFAULT_BASE_RATES[format].toFixed(2)}</b>
                    <span>
                      {format} {t.loop.seconds}
                    </span>
                  </div>
                  <i>×</i>
                  <div>
                    <b>{districtMultipliers[tile.tier].toFixed(2)}</b>
                    <span>{name(district)}</span>
                  </div>
                  <i>×</i>
                  <div>
                    <b>{BAND_MULT[band].toFixed(2)}</b>
                    <span>{p.bands[band]}</span>
                  </div>
                </div>
                <p className="lp-meter-rate">
                  <NumberFlow value={rate} format={gel(2)} locales="en-US" />
                  <span>{s.perHour}</span>
                </p>
                <p className="lp-meter-perblock">
                  {share === 0 ? (
                    s.taxiOff
                  ) : (
                    <>
                      ₾{(rate / 6).toFixed(2)} {s.perBlock}
                    </>
                  )}
                </p>

                <p className="lp-field-label lp-meter-usage">{s.usage}</p>
                <ul className="lp-meter-ledger">
                  <AnimatePresence initial={false}>
                    {m.blocks.map((b) => (
                      <motion.li
                        key={b.id}
                        layout={!reduce}
                        data-status={b.status}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: EASE }}
                      >
                        <span className="lp-meter-time">{clock(b.minute)}</span>
                        <span className="lp-meter-where">
                          {name(b.district)} · {p.bands[b.band]}
                        </span>
                        <span className="lp-meter-share">{statusLabel(b)}</span>
                        <span className="lp-meter-cost">−₾{b.cost.toFixed(2)}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        <p className="lp-fineprint lp-center lp-meter-note">{s.note}</p>
        <div className="lp-center">
          <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent('Campaign quote')}`} className="lp-btn">
            {p.cta}
          </a>
        </div>
      </div>
    </section>
  )
}
