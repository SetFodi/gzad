'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

// Day / night theme for the client portal, admin and fleet areas. The choice
// lives in localStorage and on <html data-app-theme>, which the root layout
// sets before first paint so the page never flashes the wrong theme.

type Theme = 'light' | 'dark'
export const THEME_KEY = 'gzad-app-theme'

const listeners = new Set<() => void>()

function current(): Theme {
  return document.documentElement.getAttribute('data-app-theme') === 'dark' ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

function setTheme(theme: Theme) {
  document.documentElement.setAttribute('data-app-theme', theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Private mode: the switch still works for this visit.
  }
  for (const listener of listeners) listener()
}

/** Inline script for the root layout: applies the saved or system theme before paint. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-app-theme',t)}catch(e){}})();`

/** A tiny taxi-top screen: DAY in amber, or NIGHT lit up in green. */
export default function ThemeSwitch({ georgian = false }: { georgian?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme)
  const dark = theme === 'dark'
  const label = georgian ? (dark ? 'ღამის რეჟიმი' : 'დღის რეჟიმი') : (dark ? 'Night mode' : 'Day mode')
  const hint = georgian ? 'ფერების გადართვა' : 'Switch the screen theme'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      className="led-switch"
      data-dark={dark || undefined}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={hint}
    >
      <span className="led-switch-screen" aria-hidden>
        <span className="led-switch-word led-switch-day">DAY</span>
        <span className="led-switch-word led-switch-night">NIGHT</span>
        <span className="led-switch-knob">{dark ? <Moon size={11} /> : <Sun size={11} />}</span>
        <span className="led-switch-pixels" />
      </span>
      <span className="led-switch-label">{label}</span>
    </button>
  )
}
