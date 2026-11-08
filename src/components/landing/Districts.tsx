'use client'

import type { Copy } from './copy'
import { Reveal, rich } from './Reveal'
import { TILES, gridArea } from './tiles'

// An example of districts a taxi could pass through, not selectable inventory.
const EXAMPLE_ROUTE = ['Vake', 'Saburtalo', 'Didube']

export default function Districts({ t }: { t: Copy }) {
  const name = (d: string) => t.where.districts[d] ?? d

  return (
    <section id="where" className="lp-section lp-where">
      <div className="lp-wrap lp-split">
        <Reveal className="lp-head">
          <p className="lp-eyebrow">{t.where.eyebrow}</p>
          <h2 className="lp-title">{t.where.title}</h2>
          <p className="lp-lede">{rich(t.where.lede)}</p>

          <div className="lp-where-summary">
            <p className="lp-where-label">{t.where.budgetLabel}</p>
            <p className="lp-where-list">{t.where.budget}</p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <figure className="lp-map-card">
            <ul className="lp-tilemap" aria-label={t.where.eyebrow}>
              {TILES.map((tile) => (
                <li
                  key={tile.name}
                  className="lp-tile-district"
                  style={gridArea(tile)}
                  data-route={EXAMPLE_ROUTE.includes(tile.name) || undefined}
                >
                  <span>{name(tile.name)}</span>
                </li>
              ))}
            </ul>
            <figcaption className="lp-where-caption">
              <span className="lp-where-legend">{t.where.route}</span>
              <p>{t.where.caption}</p>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
