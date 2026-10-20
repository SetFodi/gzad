'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { CONTACT, type Copy } from './copy'
import { Chevron } from './Hero'
import { Logo } from './Nav'
import RoofScreen from './RoofScreen'
import { EASE, Reveal } from './Reveal'

const fleetIcons = [
  // wrench
  <path key="0" d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z" />,
  // coins
  <g key="1">
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </g>,
  // dashboard
  <g key="2">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M7 15l3-4 3 2 4-5" />
  </g>,
]

export function Fleets({ t }: { t: Copy }) {
  return (
    <section id="fleets" className="lp-section lp-night lp-fleets">
      <div className="lp-wrap">
        <Reveal className="lp-head lp-head-center">
          <p className="lp-eyebrow">{t.fleets.eyebrow}</p>
          <h2 className="lp-title">{t.fleets.title}</h2>
        </Reveal>

        <Reveal className="lp-fleet-row" delay={0.1}>
          {[0, 1, 3].map((i) => (
            <RoofScreen key={i} ads={t.ads} index={i} glow className="lp-roof-sm" />
          ))}
        </Reveal>

        <ul className="lp-fleet-points">
          {t.fleets.items.map((f, i) => (
            <Reveal as="li" key={f.title} delay={i * 0.08} className="lp-fleet-point">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {fleetIcons[i]}
              </svg>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </Reveal>
          ))}
        </ul>

        <Reveal className="lp-center">
          <a href="/portal/fleet-signup?role=fleet" className="lp-btn lp-btn-light">
            {t.fleets.cta}
          </a>
        </Reveal>
      </div>
    </section>
  )
}

export function Faq({ t }: { t: Copy }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="lp-section lp-faq">
      <div className="lp-wrap lp-faq-wrap">
        <Reveal className="lp-head">
          <p className="lp-eyebrow">{t.faq.eyebrow}</p>
          <h2 className="lp-title">{t.faq.title}</h2>
        </Reveal>
        <ul className="lp-faq-list">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i
            return (
              <li key={item.q} className="lp-faq-item" data-open={isOpen || undefined}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`lp-faq-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.q}
                    <span className="lp-faq-icon" aria-hidden />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`lp-faq-${i}`}
                      className="lp-faq-answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      <p>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function Closing({ t }: { t: Copy }) {
  return (
    <section id="contact" className="lp-section lp-alt lp-closing">
      <div className="lp-wrap lp-center">
        <Reveal>
          <h2 className="lp-display lp-closing-title">{t.closing.title}</h2>
          <p className="lp-lede lp-closing-lede">{t.closing.lede}</p>
          <div className="lp-hero-ctas">
            <a href={`mailto:${CONTACT.email}`} className="lp-btn">
              {t.closing.email}
            </a>
            <a href={CONTACT.phoneHref} className="lp-link">
              {t.closing.call} {CONTACT.phone}
              <Chevron />
            </a>
          </div>
          <p className="lp-fineprint">
            {CONTACT.email} · {t.closing.hours}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

export function Footer({ t }: { t: Copy }) {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <Logo />
            <p>{t.footer.tagline}</p>
          </div>
          <nav className="lp-footer-cols" aria-label="Footer">
            <div>
              <h4>{t.footer.product}</h4>
              <a href="#how">{t.nav.how}</a>
              <a href="#where">{t.nav.where}</a>
              <a href="#pricing">{t.nav.pricing}</a>
              <a href="#faq">{t.nav.faq}</a>
            </div>
            <div>
              <h4>{t.footer.partners}</h4>
              <a href="#fleets">{t.nav.fleets}</a>
              <a href="/portal/fleet-signup">{t.footer.fleetSignup}</a>
              <a href="/portal/login">{t.nav.login}</a>
            </div>
            <div>
              <h4>{t.footer.legal}</h4>
              <Link href="/privacy">{t.footer.privacy}</Link>
              <Link href="/terms">{t.footer.terms}</Link>
            </div>
          </nav>
        </div>
        <div className="lp-footer-bottom">
          <p>{t.footer.rights}</p>
          <p>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <span aria-hidden> · </span>
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
