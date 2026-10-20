'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Copy, Lang } from './copy'
import { EASE } from './Reveal'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`lp-logo ${className}`}>
      <span className="lp-logo-mark" aria-hidden />
      gzad
    </span>
  )
}

function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="lp-lang" role="group" aria-label="Language">
      <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </button>
      <button type="button" lang="ka" aria-pressed={lang === 'ge'} onClick={() => setLang('ge')}>
        ქა
      </button>
    </div>
  )
}

export default function Nav({ t, lang, setLang }: { t: Copy; lang: Lang; setLang: (l: Lang) => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  const [dark, setDark] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Turn the bar dark while a night section sits under it.
  useEffect(() => {
    const under = new Set<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) under.add(e.target)
          else under.delete(e.target)
        }
        setDark(under.size > 0)
      },
      { rootMargin: '0px 0px -94% 0px', threshold: 0 },
    )
    document.querySelectorAll('.lp-night').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onResize = () => window.innerWidth >= 1024 && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const links = [
    { href: '#how', label: t.nav.how },
    { href: '#where', label: t.nav.where },
    { href: '#pricing', label: t.nav.pricing },
    { href: '#fleets', label: t.nav.fleets },
    { href: '#faq', label: t.nav.faq },
  ]

  return (
    <>
      <header className="lp-nav" data-scrolled={scrolled || undefined} data-dark={dark || undefined}>
        <nav className="lp-nav-inner" aria-label="Main">
          <a href="#top" className="lp-nav-logo" aria-label="Gzad">
            <Logo />
          </a>
          <ul className="lp-nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="lp-nav-actions">
            <LangSwitch lang={lang} setLang={setLang} />
            <a href="/portal/login" className="lp-nav-login">
              {t.nav.login}
            </a>
            <a href="#contact" className="lp-btn lp-btn-sm">
              {t.nav.cta}
            </a>
            <button
              type="button"
              className="lp-nav-burger"
              aria-label={t.nav.menu}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <span />
              <span />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="lp-sheet"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="lp-sheet-top">
              <a href="#top" onClick={() => setOpen(false)} aria-label="Gzad">
                <Logo />
              </a>
              <button type="button" className="lp-sheet-close" aria-label={t.nav.close} onClick={() => setOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <ul className="lp-sheet-links">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 + i * 0.035, duration: 0.4, ease: EASE }}
                >
                  <a href={l.href} onClick={() => setOpen(false)}>
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="lp-sheet-actions">
              <a href="#contact" className="lp-btn" onClick={() => setOpen(false)}>
                {t.nav.cta}
              </a>
              <a href="/portal/login" className="lp-btn lp-btn-ghost">
                {t.nav.login}
              </a>
              <LangSwitch lang={lang} setLang={setLang} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
