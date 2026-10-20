'use client'

import { useState } from 'react'
import type { Copy } from './copy'
import { Reveal, rich } from './Reveal'
import { TILES, gridArea } from './tiles'

const ALL = TILES.map((t) => t.name)

export default function Districts({ t }: { t: Copy }) {
  const [selected, setSelected] = useState<string[]>(['Vake', 'Saburtalo', 'Mtatsminda'])
  const name = (d: string) => t.where.districts[d] ?? d
  const toggle = (d: string) =>
    setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  const everything = selected.length === ALL.length

  return (
    <section id="where" className="lp-section lp-where">
      <div className="lp-wrap lp-split">
        <Reveal className="lp-head">
          <p className="lp-eyebrow">{t.where.eyebrow}</p>
          <h2 className="lp-title">{t.where.title}</h2>
          <p className="lp-lede">{rich(t.where.lede)}</p>

          <div className="lp-where-summary" aria-live="polite">
            <p className="lp-where-label">{t.where.selected}</p>
            <p className="lp-where-list">
              {everything
                ? t.where.all
                : selected.length
                  ? ALL.filter((d) => selected.includes(d)).map(name).join(' · ')
                  : t.where.none}
            </p>
            <div className="lp-where-actions">
              <button type="button" className="lp-chip" aria-pressed={everything} onClick={() => setSelected(ALL)}>
                {t.where.all}
              </button>
              <button type="button" className="lp-chip" onClick={() => setSelected([])} disabled={!selected.length}>
                {t.where.clear}
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lp-map-card">
          <div className="lp-tilemap" role="group" aria-label={t.where.title}>
            {TILES.map((tile) => {
              const on = selected.includes(tile.name)
              return (
                <button
                  key={tile.name}
                  type="button"
                  className="lp-tile-district"
                  style={gridArea(tile)}
                  aria-pressed={on}
                  onClick={() => toggle(tile.name)}
                >
                  <span>{name(tile.name)}</span>
                </button>
              )
            })}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
