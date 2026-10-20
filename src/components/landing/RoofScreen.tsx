'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Ad } from './copy'
import LedCanvas from './LedCanvas'
import { useLandingReducedMotion } from './useLandingReducedMotion'

/** Cycles 0..length-1 every `ms` while `running` is true. */
export function useCycle(length: number, ms: number, running = true) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!running || length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % length), ms)
    return () => window.clearInterval(id)
  }, [length, ms, running])
  return [index, setIndex] as const
}

function AdCreative({ ad }: { ad: Ad }) {
  return (
    <div className="lp-ad" data-theme={ad.theme}>
      <div className="lp-ad-copy">
        <span className="lp-ad-tag">{ad.tag}</span>
        <span className="lp-ad-brand">
          {ad.brand}
          {ad.theme === 'self' && <span className="lp-ad-cursor" aria-hidden />}
        </span>
        <span className="lp-ad-line">{ad.line}</span>
      </div>
      {ad.big && <span className="lp-ad-big">{ad.big}</span>}
    </div>
  )
}

/**
 * The taxi-top screen, drawn in CSS: a black housing, a 3:1 LED panel
 * (240 × 80 px per side, as device-sync renders it) and two roof mounts.
 */
export default function RoofScreen({
  ads,
  index,
  glow = false,
  className = '',
  label,
  led = false,
  playing = true,
}: {
  ads: Ad[]
  index: number
  glow?: boolean
  className?: string
  label?: string
  /** Render footage and copy at the panel's real 240 × 80 instead of crisp HTML. */
  led?: boolean
  playing?: boolean
}) {
  const reduce = useLandingReducedMotion()
  const ad = ads[index % ads.length]

  return (
    <figure
      className={`lp-roof ${className}`}
      data-glow={glow || undefined}
      data-theme={ad.theme}
      aria-label={label}
    >
      <div className="lp-roof-body">
        <div className="lp-roof-screen">
          {led ? (
            <LedCanvas ads={ads} index={index} playing={playing} />
          ) : (
          <AnimatePresence initial={false}>
            <motion.div
              key={index}
              className="lp-roof-frame"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <AdCreative ad={ad} />
            </motion.div>
          </AnimatePresence>
          )}
          <div className="lp-roof-pixels" aria-hidden />
          <div className="lp-roof-glass" aria-hidden />
        </div>
      </div>
      <div className="lp-roof-mounts" aria-hidden>
        <span />
        <span />
      </div>
      <div className="lp-roof-shadow" aria-hidden />
    </figure>
  )
}
