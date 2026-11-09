'use client'

import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useLandingReducedMotion } from '../landing/useLandingReducedMotion'
import { useEffect, useReducer, useRef, useState } from 'react'
import { baseRateFor, type PricingConfig } from '@/lib/billing'
import { advanceDemo, freshDemo, demoRate, demoTier, parseDemoTopUp, DEMO_DAY, DEMO_TICK_MS, type DemoBlock } from '@/lib/airtime-demo'
import type { CalculatorCopy } from './copy'
import { EASE, rich } from '../landing/Reveal'
import Segmented from '../landing/Segmented'
import { TILES, gridArea, tileByName, tileCorner, type Tier } from '../landing/tiles'

type BandKey = 'night' | 'day' | 'evening' | 'rush'
const BANDS: { key: BandKey; from: number; to: number }[] = [
  { key: 'evening', from: 0, to: 60 }, { key: 'night', from: 60, to: 420 },
  { key: 'rush', from: 420, to: 600 }, { key: 'day', from: 600, to: 1020 },
  { key: 'rush', from: 1020, to: 1200 }, { key: 'evening', from: 1200, to: 1440 },
]
const bandAt = (minute: number) => BANDS.find(b => minute >= b.from && minute < b.to)!.key
const TOP_UPS = [500, 1000, 2500]
const CAPS = ['none', '20', '50']
const FORMATS = ['10', '20', '30']
const TIERS: Tier[] = ['1', '2', '3', '4']
const LOW_BALANCE_SHARE = .2

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const x = (n: number) => `×${n.toFixed(2)}`
export default function AirtimeSimulator({ t, config }: { t: CalculatorCopy; config: PricingConfig }) {
  const p = t.pricing
  const s = p.sim
  const reduce = useLandingReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-15% 0px' })
  const [format, setFormat] = useState('20')
  const [capKey, setCapKey] = useState('20')
  const [playing, setPlaying] = useState<boolean | null>(null)
  const [m, dispatch] = useReducer(advanceDemo, 1000, freshDemo)
  const [custom, setCustom] = useState('')
  const [invalid, setInvalid] = useState(false)
  const { districtMultipliers } = config
  const cap = capKey === 'none' ? null : Number(capKey)

  // Plays on its own unless the visitor prefers reduced motion or pressed pause.
  const on = playing ?? !reduce
  const running = on && inView && m.balance > 0

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => dispatch({ type: 'tick', duration: Number(format), cap, config }), DEMO_TICK_MS)
    return () => window.clearInterval(id)
  }, [running, format, cap, config])

  // The block being metered right now.
  const [district, share] = DEMO_DAY[m.blockN % DEMO_DAY.length]
  const tile = tileByName[district]
  const blockStart = m.minute - (m.minute % 10)
  const band = bandAt(blockStart)
  const rate = demoRate(config, Number(format), district, blockStart)
  const tier = demoTier(config, district)
  const timeRate = config.timeMultipliers[String(Math.floor(blockStart / 60))] ?? 1
  const nextPost = 15 - (m.minute % 15)
  const car = tileCorner(tile)
  const name = (d: string) => t.where.districts[d] ?? d

  const statusLabel = (b: DemoBlock) =>
    b.status === 'off' ? s.off : b.status === 'capped' ? s.capped : b.status === 'empty' ? s.emptyShort : `${Math.round(b.share * 100)}%`

  return (
    <section aria-labelledby="airtime-title">
      <div className="guide-section-head">
        <h2 id="airtime-title">{p.title}</h2>
        <p>{rich(p.lede)}</p>
      </div>
      <div ref={ref} className="lp-meter">
        <div className="lp-meter-top">
          <div className="lp-meter-balance">
            <p className="lp-field-label">{s.balance}</p>
            <div className="lp-meter-amount-row">
              <p className="lp-meter-amount">
                ₾{m.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    onClick={() => { dispatch({ type: 'topUp', amount: a }); setCustom(''); setInvalid(false) }}
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
              <form className="demo-custom" noValidate onSubmit={e => {
                e.preventDefault()
                const amount = parseDemoTopUp(custom)
                setInvalid(amount === null)
                if (amount !== null) dispatch({ type: 'topUp', amount })
              }}>
                <label htmlFor="demo-topup">{s.customTopUp}</label>
                <div>
                  <span aria-hidden>₾</span>
                  <input id="demo-topup" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01"
                    value={custom} onChange={e => { setCustom(e.target.value); setInvalid(false) }}
                    aria-label={s.amountAria} aria-invalid={invalid} aria-describedby={invalid ? 'demo-topup-error' : undefined} />
                  <button type="submit">{s.useAmount}</button>
                </div>
                {invalid && <p id="demo-topup-error" role="alert">{s.invalidAmount}</p>}
              </form>
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
                  data-tier={demoTier(config, d.name)}
                  data-current={d.name === district || undefined}
                  style={gridArea(d)}
                >
                  <span>{name(d.name)}</span>
                  <em>{x(districtMultipliers[demoTier(config, d.name)] ?? 1)}</em>
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
                  {p.tiers[tier]} {x(districtMultipliers[tier] ?? 1)}
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
                <li>{clock(blockStart)} · {x(timeRate)}</li>
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
                <b>₾{baseRateFor(config, Number(format)).toFixed(2)}</b>
                <span>
                  {format} {t.loop.seconds}
                </span>
              </div>
              <i>×</i>
              <div>
                <b>{(districtMultipliers[tier] ?? 1).toFixed(2)}</b>
                <span>{name(district)}</span>
              </div>
              <i>×</i>
              <div>
                <b>{timeRate.toFixed(2)}</b>
                <span>{p.bands[band]}</span>
              </div>
            </div>
            <p className="lp-meter-rate">
              ₾{rate.toFixed(2)}
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
                      {name(b.district)} · {p.bands[bandAt(b.minute)]}
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
      <p className="lp-fineprint lp-center lp-meter-note">{s.note}</p>

    </section>
  )
}
