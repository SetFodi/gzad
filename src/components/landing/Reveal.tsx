'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLandingReducedMotion } from './useLandingReducedMotion'

// Apple-style easing: quick to start, long gentle settle.
export const EASE = [0.22, 1, 0.36, 1] as const

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'li' | 'section'
}) {
  const reduce = useLandingReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      data-reveal=""
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}

/** Renders "muted text **emphasised text** muted text" with the emphasis in <strong>. */
export function rich(text: string): ReactNode[] {
  return text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}
