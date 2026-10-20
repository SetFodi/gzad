'use client'

import type { Copy } from './copy'
import { Reveal } from './Reveal'

// One small, purely decorative illustration per feature tile, in copy order.
const visuals = [
  <div key="sides" className="lp-viz lp-viz-sides">
    <span />
    <span />
  </div>,
  <div key="nits" className="lp-viz lp-viz-nits">
    <span className="lp-viz-sun" />
  </div>,
  <div key="swap" className="lp-viz lp-viz-swap">
    <span data-a />
    <span data-b />
  </div>,
  <div key="check" className="lp-viz lp-viz-check">
    <svg viewBox="0 0 48 48" width="48" height="48">
      <circle cx="24" cy="24" r="22" />
      <path d="M14 24.5l7 7L34 18" />
    </svg>
  </div>,
  <div key="balance" className="lp-viz lp-viz-balance">
    <span className="lp-viz-balance-track">
      <span className="lp-viz-balance-fill" />
    </span>
    <span className="lp-viz-balance-label">₾186.40</span>
  </div>,
  <div key="map" className="lp-viz lp-viz-map">
    <span className="lp-viz-map-dot" />
  </div>,
]

export function Features({ t }: { t: Copy }) {
  return (
    <section className="lp-section lp-alt lp-features">
      <div className="lp-wrap">
        <Reveal className="lp-head lp-head-center">
          <p className="lp-eyebrow">{t.features.eyebrow}</p>
          <h2 className="lp-title">{t.features.title}</h2>
        </Reveal>
        <ul className="lp-bento">
          {t.features.items.map((f, i) => (
            <Reveal as="li" key={i} delay={(i % 3) * 0.07} className="lp-tile" >
              <div className="lp-tile-viz" aria-hidden>
                {visuals[i]}
              </div>
              <h3 className="lp-tile-title">{f.title}</h3>
              <p className="lp-tile-body">{f.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function Steps({ t }: { t: Copy }) {
  return (
    <section id="how" className="lp-section lp-steps">
      <div className="lp-wrap">
        <Reveal className="lp-head lp-head-center">
          <p className="lp-eyebrow">{t.steps.eyebrow}</p>
          <h2 className="lp-title">{t.steps.title}</h2>
        </Reveal>
        <ol className="lp-steps-list">
          {t.steps.items.map((s, i) => (
            <Reveal as="li" key={i} delay={i * 0.1} className="lp-step">
              <span className="lp-step-num" aria-hidden>
                {i + 1}
              </span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-body">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
