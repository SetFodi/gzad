import { NextRequest, NextResponse } from 'next/server'
import { authTemplate, billingAlertEmail, contactNotificationHtml } from '@/lib/email/messages'

// Local preview of every email: /dev/emails?kind=signin|signup|recovery|low|runway|depleted|contact.
// Never served in production.
export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse('Not found', { status: 404 })
  const site = request.nextUrl.origin
  const billingUrl = `${site}/portal/dashboard/billing`
  const kind = request.nextUrl.searchParams.get('kind') ?? 'signin'
  const html =
    kind === 'signin' || kind === 'signup' || kind === 'recovery'
      ? authTemplate(kind).replaceAll('{{ .Token }}', '816217').replaceAll('{{ .SiteURL }}', site)
      : kind === 'low' ? billingAlertEmail({ kind: 'low_20pct', balance: 19.5, pct: 20, billingUrl, siteUrl: site }).html
      : kind === 'runway' ? billingAlertEmail({ kind: 'runway_1d', balance: 42.3, billingUrl, siteUrl: site }).html
      : kind === 'depleted' ? billingAlertEmail({ kind: 'depleted', balance: 0, billingUrl, siteUrl: site }).html
      : contactNotificationHtml({
        name: 'Nino Beridze', email: 'nino@puri.ge', company: 'Puri House', phone: '+995 555 12 34 56', topic: 'quote', lang: 'ge',
        message: 'Hello! We want to advertise our new bakery in Vake for two weeks in December.\nBudget around ₾500. What would you recommend?',
      }, site)
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
