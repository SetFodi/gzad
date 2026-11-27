'use client'

import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { LanguageProvider, useTranslations } from '@/lib/i18n'
import { copy, type Lang } from './copy'
import Districts from './Districts'
import { Features, Steps } from './Features'
import Hero from './Hero'
import Loop, { Facts } from './Loop'
import Nav from './Nav'
import { Closing, Faq, Fleets, Footer } from './Outro'
import Pricing from './Pricing'
import Proof from './Proof'

function Page({ style }: { style?: CSSProperties }) {
  // The address decides the language (/ Georgian, /en English); a switch is
  // also stored, so the portal opens in the language picked here.
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
        <Closing t={t} lang={lang} />
      </main>
      <Footer t={t} />
    </div>
  )
}

export default function Landing({ style, lang }: { style?: CSSProperties; lang: Lang }) {
  const router = useRouter()
  return (
    <LanguageProvider forceLang={lang} onLangChange={(next) => { if (next !== lang) router.push(next === 'en' ? '/en' : '/') }}>
      <Page style={style} />
    </LanguageProvider>
  )
}
