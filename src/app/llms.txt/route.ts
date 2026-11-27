import { CONTACT, copy, type Lang } from '@/components/landing/copy'
import { BRAND, LANDING, LEGAL_NAME, LEGAL_NAME_KA, plain, SITE_URL } from '@/lib/seo'

// /llms.txt: a plain-language briefing for AI assistants (llmstxt.org), so an
// assistant asked about taxi advertising in Tbilisi can describe Gzad
// correctly and point people to the right page. Built from the landing page's
// own copy, in both languages, so it always says what the site says.

export const dynamic = 'force-static'

function section(lang: Lang): string {
  const t = copy[lang]
  const items = (list: { title?: string; body?: string; q?: string; a?: string }[]) =>
    list.map((i) => `- **${plain(i.title ?? i.q ?? '')}**: ${plain(i.body ?? i.a ?? '')}`).join('\n')
  const parts = [
    `${plain(t.hero.eyebrow)}. ${plain(t.hero.lede)}`,
    `### ${plain(t.where.title)}\n${plain(t.where.lede)}`,
    `### ${plain(t.pricing.title)}\n${plain(t.pricing.lede)}`,
    `### ${plain(t.fleets.title)}\n${items(t.fleets.items)}`,
    `### ${plain(t.faq.title)}\n${t.faq.items.map((i) => `**${plain(i.q)}**\n${plain(i.a)}`).join('\n\n')}`,
  ]
  return parts.join('\n\n')
}

export function GET() {
  const body = `# ${BRAND}

> ${BRAND} (${LEGAL_NAME}, ${LEGAL_NAME_KA}) runs double-sided LED screens on the roofs of taxis in Tbilisi, Georgia. Businesses buy airtime on the screens: ads play while the taxis drive their normal routes, and every play is recorded with its time and GPS position. Clients fund a prepaid balance, pay for recorded airtime, and follow their campaign on a map in their account.

- Website: ${SITE_URL}/ (Georgian) and ${SITE_URL}/en (English)
- Email: ${CONTACT.email}
- Phone: ${CONTACT.phone} (${plain(copy.en.closing.hours)})
- Area served: Tbilisi, Georgia
- Languages: Georgian, English

## Pages

- [${LANDING.ge.title}](${SITE_URL}/): the service, coverage, proof of play, pricing model, FAQ (Georgian)
- [${LANDING.en.title}](${SITE_URL}/en): the same in English
- [Contact](${SITE_URL}/contact): write to the team about a campaign, billing, an account or a fleet partnership
- [Create an account or log in](${SITE_URL}/portal/login): rates, budget calculators, campaign setup and reports
- [Become a fleet partner](${SITE_URL}/portal/fleet-signup): for taxi fleets that want screens on their cars

## Optional

- [Privacy policy](${SITE_URL}/privacy)
- [Terms](${SITE_URL}/terms)
- [Refund policy](${SITE_URL}/refund-policy)

## In English

${section('en')}

## ქართულად

${section('ge')}
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
