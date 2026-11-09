'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Calculator } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import type { PricingConfig } from '@/lib/billing'
import { finishClientIntroduction } from '@/lib/client-onboarding'
import { calculatorCopy } from './copy'
import AirtimeSimulator from './AirtimeSimulator'
import BudgetCalculator from './BudgetCalculator'
import './calculators.css'

export default function ClientGuide({ config, welcome = false }: { config: PricingConfig | null; welcome?: boolean }) {
  const { lang } = useTranslations()
  const t = calculatorCopy[lang]
  const g = t.guide
  const [part, setPart] = useState(welcome ? 'intro' : 'tools')

  return (
    <div className="portal-page client-calculators" lang={lang === 'ge' ? 'ka' : 'en'}>
      <header className="portal-page-header">
        <div>
          {welcome && <p className="guide-welcome">{g.welcome}</p>}
          <h1 className="portal-page-title">{g.title}</h1>
          <p className="portal-subtitle">{g.lede}</p>
        </div>
      </header>
      <div className="guide-tabs" role="tablist" aria-label={g.title} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 'intro' : event.key === 'End' ? 'tools' : part === 'intro' ? 'tools' : 'intro'
        setPart(next)
        document.getElementById(`guide-${next}-tab`)?.focus()
      }}>
        <button id="guide-intro-tab" type="button" role="tab" tabIndex={part === 'intro' ? 0 : -1} aria-selected={part === 'intro'} aria-controls="guide-intro" onClick={() => setPart('intro')}>
          <BookOpen size={17} aria-hidden />{g.introTab}
        </button>
        <button id="guide-tools-tab" type="button" role="tab" tabIndex={part === 'tools' ? 0 : -1} aria-selected={part === 'tools'} aria-controls="guide-tools" onClick={() => setPart('tools')}>
          <Calculator size={17} aria-hidden />{g.toolsTab}
        </button>
      </div>
      {part === 'intro' ? (
        <section id="guide-intro" role="tabpanel" aria-labelledby="guide-intro-tab" className="guide-intro">
          <h2>{g.introTitle}</h2>
          <ol>
            {g.introItems.map((item, i) => <li key={item.title}><span aria-hidden>{i + 1}</span><h3>{item.title}</h3><p>{item.body}</p></li>)}
          </ol>
          <button className="portal-btn-primary" type="button" onClick={() => setPart('tools')}>{g.tryTools}<ArrowRight size={16} aria-hidden /></button>
        </section>
      ) : (
        <div id="guide-tools" role="tabpanel" aria-labelledby="guide-tools-tab">
          <p className="guide-practice">{g.simulation}</p>
          {config ? <><AirtimeSimulator t={t} config={config} /><BudgetCalculator t={t} config={config} /></> : <p className="portal-alert portal-alert-error" role="alert">{g.unavailable}</p>}
        </div>
      )}
      <div className="guide-finish"><Link className="portal-btn-primary" href="/portal/dashboard" onClick={finishClientIntroduction}>{g.continue}<ArrowRight size={16} aria-hidden /></Link></div>
    </div>
  )
}
