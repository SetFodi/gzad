'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations } from '@/app/translations'

type Lang = 'en' | 'ge'
type Translations = typeof translations.en

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ge')

  useEffect(() => {
    const stored = localStorage.getItem('gzad-lang') as Lang | null
    if (stored && (stored === 'en' || stored === 'ge')) {
      setLangState(stored)
    }
  }, [])

  const setLang = (newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('gzad-lang', newLang)
  }

  const t = translations[lang] as Translations

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslations() {
  return useContext(LanguageContext)
}
