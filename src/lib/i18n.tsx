'use client'

import { createContext, useContext, useSyncExternalStore, ReactNode } from 'react'
import { translations } from '@/app/translations'

type Lang = 'en' | 'ge'
type Translations = typeof translations.en

const STORAGE_KEY = 'gzad-lang'
const DEFAULT_LANG: Lang = 'ge'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

// The chosen language lives in localStorage, which React can't see during
// render. Exposing it as an external store lets the server render the default
// and the client correct it on hydration, without a setState-in-effect.
let cachedLang: Lang | null = null
const listeners = new Set<() => void>()

function getSnapshot(): Lang {
  if (cachedLang) return cachedLang
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
  cachedLang = stored === 'en' || stored === 'ge' ? stored : DEFAULT_LANG
  return cachedLang
}

function getServerSnapshot(): Lang {
  return DEFAULT_LANG
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => { listeners.delete(onStoreChange) }
}

function writeLang(lang: Lang) {
  cachedLang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Preference just won't persist.
  }
  for (const listener of listeners) listener()
}

const LanguageContext = createContext<LanguageContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: translations[DEFAULT_LANG] as Translations,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const t = translations[lang] as Translations

  return (
    <LanguageContext.Provider value={{ lang, setLang: writeLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslations() {
  return useContext(LanguageContext)
}
