'use client'

import { useSyncExternalStore } from 'react'

// The stored theme is applied to <html> by an inline script in app/layout.tsx
// before first paint. React reads it here through an external store so the
// server can render the light default and hydration corrects it, rather than
// setting state inside an effect.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'gzad-theme'
const DEFAULT_THEME: Theme = 'light'

let cached: Theme | null = null
const listeners = new Set<() => void>()

function getSnapshot(): Theme {
  if (cached) return cached
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — fall back to the default.
  }
  cached = stored === 'dark' ? 'dark' : DEFAULT_THEME
  return cached
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => { listeners.delete(onStoreChange) }
}

function setTheme(theme: Theme) {
  cached = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Preference just won't persist.
  }
  for (const listener of listeners) listener()
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [theme, setTheme]
}
