'use client'

import { useCallback } from 'react'
import { useTranslations } from './i18n'
import { KA } from './admin-ka'

// Admin text is written in English at the call site, t('Campaigns'), and
// looked up in one Georgian dictionary (admin-ka.ts) so translations can be
// reviewed in one place. A missing entry falls back to English. Placeholders
// use {name}: t('{count} screens online', { count: 3 }).

export type AdminLang = 'en' | 'ge'

export function translate(lang: AdminLang, en: string, vars?: Record<string, string | number>): string {
  let text = lang === 'ge' ? KA[en] ?? en : en
  if (vars) for (const [key, value] of Object.entries(vars)) text = text.split(`{${key}}`).join(String(value))
  return text
}

export function useAdminText() {
  const { lang } = useTranslations()
  const t = useCallback(
    (en: string, vars?: Record<string, string | number>) => translate(lang, en, vars),
    [lang],
  )
  return { t, lang, locale: lang === 'ge' ? 'ka-GE' : 'en-GB' }
}
