'use client'

import Link from 'next/link'
import { CONTACT, type Copy } from './copy'
import { Reveal, rich } from './Reveal'

export default function Pricing({ t }: { t: Copy }) {
  const p = t.pricing
  return (
    <section id="pricing" className="lp-section lp-alt lp-pricing">
      <div className="lp-wrap">
        <Reveal className="lp-pricing-invite">
          <p className="lp-eyebrow">{p.eyebrow}</p>
          <h2 className="lp-title">{p.title}</h2>
          <p className="lp-lede">{rich(p.lede)}</p>
          <div className="lp-pricing-actions">
            <Link href="/portal/fleet-signup" className="lp-btn">{p.register}</Link>
            <Link href="/portal/login" className="lp-btn lp-btn-ghost">{p.login}</Link>
          </div>
          <a className="lp-pricing-contact" href={`mailto:${CONTACT.email}`}>{p.contact} ↗</a>
        </Reveal>
      </div>
    </section>
  )
}
