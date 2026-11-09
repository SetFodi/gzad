'use client'

import ThemeSwitch from '@/components/app/ThemeSwitch'
import type { Lang } from './copy'

export default function ThemeToggle({ lang }: { lang: Lang }) {
  return <div className="lp-theme-toggle"><ThemeSwitch georgian={lang === 'ge'} /></div>
}
