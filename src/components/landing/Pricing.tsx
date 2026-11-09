'use client'

import Link from 'next/link'
import { useTranslations } from '@/lib/i18n'
import { parsePricingConfig, type PricingConfig } from '@/lib/billing'
import { BANDS } from '@/lib/budget-estimate'
import AirtimeSimulator from '@/components/education/AirtimeSimulator'
import BudgetCalculator from '@/components/education/BudgetCalculator'
import { calculatorCopy } from '@/components/education/copy'
import '@/components/education/calculators.css'
import { CONTACT, type Copy } from './copy'
import { Reveal } from './Reveal'
import { TILES } from './tiles'

// Public examples use the published base rates and illustrative routes/time bands.
// The signed-in guide continues to load the current account pricing configuration.
const demoConfig: PricingConfig = {
  ...parsePricingConfig(null),
  districtTiers: Object.fromEntries(TILES.map(tile => [tile.name, Number(tile.tier)])),
  timeMultipliers: Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [String(hour),
    hour >= 1 && hour < 7 ? BANDS.night.multiplier
      : (hour >= 7 && hour < 10) || (hour >= 17 && hour < 20) ? BANDS.rush.multiplier
        : hour >= 10 && hour < 17 ? BANDS.day.multiplier : BANDS.evening.multiplier,
  ])),
}

export default function Pricing({ t }: { t: Copy }) {
  const p = t.pricing
  const { lang } = useTranslations()
  const details = calculatorCopy[lang]
  const publicDetails = {
    ...details,
    pricing: {
      ...details.pricing,
      sim: {
        ...details.pricing.sim,
        note: lang === 'ge'
          ? 'ერთი ეკრანის მაგალითი საორიენტაციო ტარიფებით. ზუსტ პირობებს კამპანიის დაგეგმვისას დაგიდასტურებთ.'
          : 'An example for one screen using illustrative rates. We confirm your exact terms when planning your campaign.',
      },
      calc: {
        ...details.pricing.calc,
        range: lang === 'ge'
          ? 'დიაპაზონი ითვლება საორიენტაციო უბნებისა და დღის დროის ტარიფებით. რეალური შედეგი ტაქსების მგზავრობებსა და აღრიცხულ ჩვენებებზეა დამოკიდებული.'
          : 'The range uses illustrative district and time-of-day rates. Actual delivery depends on the taxis’ trips and recorded plays.',
      },
    },
  }
  return (
    <section id="pricing" className="lp-section lp-alt lp-pricing">
      <div className="lp-wrap">
        <div className="client-calculators landing-calculators">
          <p className="lp-eyebrow lp-center">{details.pricing.eyebrow}</p>
          <AirtimeSimulator t={publicDetails} config={demoConfig} />
          <BudgetCalculator t={publicDetails} config={demoConfig} />
        </div>
        <Reveal className="lp-pricing-invite">
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
