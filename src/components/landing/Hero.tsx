'use client'

import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import type { Copy } from './copy'
import RoofScreen, { useCycle } from './RoofScreen'
import { EASE, rich } from './Reveal'
import { useLandingReducedMotion } from './useLandingReducedMotion'

export default function Hero({ t }: { t: Copy }) {
  const reduce = useLandingReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const [index] = useCycle(t.ads.length, 3400, !reduce)

  // The screen starts tilted away and settles flat as it scrolls into view.
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'center 55%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 })
  const rotateX = useTransform(progress, [0, 1], [26, 0])
  const scale = useTransform(progress, [0, 1], [0.86, 1])

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 1, delay: reduce ? 0 : delay, ease: EASE },
  })

  return (
    <section id="top" className="lp-hero">
      <div className="lp-wrap lp-hero-text">
        <motion.p className="lp-eyebrow" {...enter(0.05)}>
          {t.hero.eyebrow}
        </motion.p>
        <motion.h1 className="lp-display" {...enter(0.12)}>
          {t.hero.titleA} <span className="lp-display-line">{t.hero.titleB}</span>
        </motion.h1>
        <motion.p className="lp-lede lp-hero-lede" {...enter(0.22)}>
          {rich(t.hero.lede)}
        </motion.p>
        <motion.div className="lp-hero-ctas" {...enter(0.32)}>
          <a href="#contact" className="lp-btn">
            {t.hero.primary}
          </a>
          <a href="#how" className="lp-link">
            {t.hero.secondary}
            <Chevron />
          </a>
        </motion.div>
        <motion.p className="lp-status" {...enter(0.42)}>
          <span className="lp-status-dot" aria-hidden />
          {t.hero.status}
        </motion.p>
      </div>

      <div ref={stage} className="lp-hero-stage">
        <motion.div
          className="lp-hero-product"
          style={reduce ? undefined : { rotateX, scale, transformPerspective: 1400 }}
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : 0.35, ease: EASE }}
        >
          <RoofScreen ads={t.ads} index={index} label={t.hero.eyebrow} />
          <div className="lp-car-roof" aria-hidden />
        </motion.div>
      </div>
    </section>
  )
}

export function Chevron() {
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" fill="none" aria-hidden>
      <path d="M1.5 1.5L7 7l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
