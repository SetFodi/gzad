'use client'

import { useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Copy } from './copy'
import TaxiDrive from './TaxiDrive'
import { Reveal, rich } from './Reveal'
import { useLandingReducedMotion } from './useLandingReducedMotion'

// Real slots run 10–30 s; the demo gives each one about five seconds.
const DEMO_SLOT_MS = 5200
const YOUR_SLOT = 2

export function Facts({ t }: { t: Copy }) {
  return (
    <section className="lp-facts" aria-label="Key facts">
      <div className="lp-wrap lp-facts-grid">
        {t.facts.map((f, i) => (
          <Reveal key={f.label} delay={i * 0.06} className="lp-fact">
            <p className="lp-fact-value">
              <span className="lp-fact-number">{f.value}</span>
              {f.unit && <span className="lp-fact-unit">{f.unit}</span>}
            </p>
            <p className="lp-fact-label">{f.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export default function Loop({ t }: { t: Copy }) {
  const reduce = useLandingReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-20% 0px -20% 0px' })
  const [slot, setSlot] = useState(0)
  const [paused, setPaused] = useState(false)
  const playing = inView && !reduce && !paused

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => setSlot((s) => (s + 1) % t.ads.length), DEMO_SLOT_MS)
    return () => window.clearTimeout(id)
  }, [playing, slot, t.ads.length])

  return (
    <section id="loop" className="lp-section lp-night lp-loop">
      <div className="lp-wrap">
        <Reveal className="lp-head lp-head-center">
          <p className="lp-eyebrow">{t.loop.eyebrow}</p>
          <h2 className="lp-title">{t.loop.title}</h2>
          <p className="lp-lede">{rich(t.loop.lede)}</p>
        </Reveal>

        <div ref={ref} className="lp-loop-stage">
          <TaxiDrive ads={t.ads} index={slot} playing={playing} label={t.loop.sceneLabel} />

          <div className="lp-loop-controls">
            <ol className="lp-loop-bars" aria-label={t.loop.eyebrow}>
              {t.ads.map((ad, i) => {
                const state = i < slot ? 'done' : i === slot ? 'active' : 'idle'
                return (
                  <li key={i} data-you={i === YOUR_SLOT || undefined}>
                    <button
                      type="button"
                      onClick={() => setSlot(i)}
                      aria-current={i === slot || undefined}
                      aria-label={i === YOUR_SLOT ? t.loop.you : ad.brand}
                    >
                      <span className="lp-bar" data-state={state}>
                        <span
                          key={state === 'active' ? `${slot}-${playing}` : state}
                          className="lp-bar-fill"
                          data-playing={(state === 'active' && playing) || undefined}
                          style={{ animationDuration: `${DEMO_SLOT_MS}ms` }}
                        />
                      </span>
                      <span className="lp-bar-label">
                        {i === YOUR_SLOT ? t.loop.you : ad.brand}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            {!reduce && (
              <button
                type="button"
                className="lp-loop-toggle"
                aria-label={paused ? t.loop.play : t.loop.pause}
                title={paused ? t.loop.play : t.loop.pause}
                onClick={() => setPaused((current) => !current)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  {paused ? <path d="M5 2.5 13 8l-8 5.5Z" /> : <path d="M4 3h3v10H4ZM10 3h3v10h-3Z" />}
                </svg>
              </button>
            )}
          </div>
          <p className="lp-loop-caption">{t.loop.caption}</p>
        </div>
      </div>
    </section>
  )
}
