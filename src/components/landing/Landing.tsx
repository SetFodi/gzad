'use client'

import type { CSSProperties } from 'react'
import { LanguageProvider, useTranslations } from '@/lib/i18n'
import { copy } from './copy'
import Districts from './Districts'
import { Features, Steps } from './Features'
import Hero from './Hero'
import Loop, { Facts } from './Loop'
import Nav from './Nav'
import { Closing, Faq, Fleets, Footer } from './Outro'
import Pricing from './Pricing'
import Proof from './Proof'

function Page({ style }: { style?: CSSProperties }) {
  // Shares the portal's stored language choice (localStorage "gzad-lang").
  const { lang, setLang } = useTranslations()
  const t = copy[lang]

  return (
    <div className="lp" style={style} lang={lang === 'ge' ? 'ka' : 'en'}>
      <Nav t={t} lang={lang} setLang={setLang} />
      <main>
        <Hero t={t} />
        <Facts t={t} />
        <Loop t={t} />
        <Districts t={t} />
        <Proof t={t} />
        <Features t={t} />
        <Steps t={t} />
        <Pricing t={t} />
        <Fleets t={t} />
        <Faq t={t} />
        <Closing t={t} />
      </main>
      <Footer t={t} />
    </div>
  )
}

export default function Landing({ style }: { style?: CSSProperties }) {
  return (
    <LanguageProvider>
      <Page style={style} />
    </LanguageProvider>
  )
}
