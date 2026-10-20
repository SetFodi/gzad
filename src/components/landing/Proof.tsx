'use client'

import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Copy } from './copy'
import { EASE, Reveal, rich } from './Reveal'
import { useLandingReducedMotion } from './useLandingReducedMotion'

// Illustrative log rows: one play per 50-second loop, as a car crosses town.
const ROUTE = ['Vake', 'Vake', 'Saburtalo', 'Saburtalo', 'Didube', 'Chughureti', 'Mtatsminda', 'Mtatsminda']
const START = 14 * 3600 + 2 * 60 + 10
const LOOP_S = 50
const VISIBLE = 5

const clock = (s: number) =>
  [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')

export default function Proof({ t }: { t: Copy }) {
  const reduce = useLandingReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-15% 0px' })
  const [count, setCount] = useState(VISIBLE)

  useEffect(() => {
    if (!inView || reduce) return
    const id = window.setInterval(() => setCount((c) => c + 1), 1900)
    return () => window.clearInterval(id)
  }, [inView, reduce])

  const rows = Array.from({ length: VISIBLE }, (_, i) => count - 1 - i).map((n) => ({
    n,
    time: clock(START + n * LOOP_S),
    district: t.where.districts[ROUTE[n % ROUTE.length]],
  }))

  return (
    <section className="lp-section lp-night lp-proof">
      <div className="lp-wrap lp-split">
        <Reveal className="lp-head">
          <p className="lp-eyebrow">{t.proof.eyebrow}</p>
          <h2 className="lp-title">{t.proof.title}</h2>
          <p className="lp-lede">{rich(t.proof.lede)}</p>
        </Reveal>

        <Reveal delay={0.1}>
          <div ref={ref} className="lp-log-card">
            <div className="lp-log-map" aria-hidden>
              <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="lp-route" x1="0" x2="1">
                    <stop offset="0" stopColor="#34d399" stopOpacity="0.15" />
                    <stop offset="1" stopColor="#34d399" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
                <g className="lp-log-streets">
                  <path d="M-10 40 L410 28" />
                  <path d="M-10 112 L410 98" />
                  <path d="M70 -10 L110 160" />
                  <path d="M200 -10 L214 160" />
                  <path d="M310 -10 L292 160" />
                  <path d="M-10 78 Q120 60 220 76 T410 66" className="lp-log-river" />
                </g>
                <path
                  id="lp-route-path"
                  d="M24 128 C80 118 96 92 128 84 S196 50 238 56 S318 40 376 22"
                  fill="none"
                  stroke="url(#lp-route)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle r="6" className="lp-log-car">
                  {!reduce && (
                    <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#lp-route-path" />
                    </animateMotion>
                  )}
                </circle>
              </svg>
              <span className="lp-log-live">
                <span className="lp-status-dot" />
                {t.proof.live}
              </span>
            </div>

            <div className="lp-log-head">
              <span>{t.proof.logTitle}</span>
              <span>TX-04</span>
            </div>
            <ul className="lp-log-rows">
              <AnimatePresence initial={false}>
                {rows.map((r) => (
                  <motion.li
                    key={r.n}
                    layout={!reduce}
                    initial={{ opacity: 0, y: -14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    <span className="lp-log-time">{r.time}</span>
                    <span className="lp-log-place">{r.district}</span>
                    <span className="lp-log-ok">
                      10 {t.loop.seconds}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
