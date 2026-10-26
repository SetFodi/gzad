import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KA } from './admin-ka'
import { translate } from './admin-i18n'

const ROOTS = ['src/app/admin', 'src/components/admin', 'src/components/app', 'src/lib/activity.ts']

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap((name) => files(join(path, name)))
}

// Every literal key passed to t('…') in admin code.
function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>()
  for (const file of ROOTS.flatMap(files).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\bt\(\s*(['"])((?:(?!\1)[^\\]|\\.)+)\1/g)) {
      keys.set(match[2].replace(/\\(['"])/g, '$1'), file)
    }
  }
  return keys
}

describe('admin Georgian dictionary', () => {
  it('has a translation for every admin string', () => {
    const missing = [...usedKeys()].filter(([key]) => !(key in KA)).map(([key, file]) => `${key}   (${file})`)
    expect(missing).toEqual([])
  })

  it('keeps every placeholder in the translation', () => {
    const broken = Object.entries(KA).filter(([en, ge]) => {
      const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
      return names(en) !== names(ge)
    })
    expect(broken).toEqual([])
  })

  it('fills placeholders and falls back to English', () => {
    expect(translate('ge', 'Campaigns')).toBe('კამპანიები')
    expect(translate('en', 'Campaigns')).toBe('Campaigns')
    expect(translate('ge', 'Not in the dictionary')).toBe('Not in the dictionary')
  })
})
