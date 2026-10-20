'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export interface AuthAd {
  tag: string
  brand: string
  line: string
  big?: string
  theme: string
}

/**
 * The taxi-top screen from the landing page, drawn in CSS: a black housing, a
 * 3:1 LED panel (240 × 80 per side, as device-sync renders it) and two mounts.
 * It cycles through sample ads; with reduced motion it holds the first one.
 */
export default function AuthScreen({ ads }: { ads: AuthAd[] }) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce || ads.length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ads.length), 3600)
    return () => window.clearInterval(id)
  }, [ads.length, reduce])

  const ad = ads[index % ads.length]

  return (
    <figure className="auth-roof" data-theme={ad.theme} aria-hidden>
      <div className="auth-roof-body">
        <div className="auth-roof-screen">
          <AnimatePresence initial={false}>
            <motion.div
              key={index}
              className="auth-roof-frame"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="auth-ad" data-theme={ad.theme}>
                <div className="auth-ad-copy">
                  <span className="auth-ad-tag">{ad.tag}</span>
                  <span className="auth-ad-brand">{ad.brand}</span>
                  <span className="auth-ad-line">{ad.line}</span>
                </div>
                {ad.big && <span className="auth-ad-big">{ad.big}</span>}
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="auth-roof-pixels" />
        </div>
      </div>
      <div className="auth-roof-mounts">
        <span />
        <span />
      </div>
    </figure>
  )
}
