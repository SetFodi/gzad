import type { Metadata } from 'next'
import LegalPage, { Section } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service | Gzad',
  description: 'The terms governing advertising and fleet partnership on the Gzad network.',
}

// DRAFT — describes how the platform actually behaves (prepaid balance, hourly
// slot-hour billing, five slots per screen, manual review of creative). Have a
// Georgian lawyer review before publishing, and fill in the bracketed details.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="7 August 2026">
      <p>
        These terms govern use of the Gzad advertising network by advertisers and
        fleet partners. Creating an account means accepting them.
      </p>

      <Section heading="Who we are">
        <p>
          Gzad is operated by <strong>[legal entity name]</strong>, identification
          number <strong>[ID number]</strong>, registered at{' '}
          <strong>[registered address], Tbilisi, Georgia</strong>.
        </p>
      </Section>

      <Section heading="Accounts">
        <p>
          You must give accurate registration details and keep your credentials
          secure. You are responsible for activity under your account. We may suspend
          an account that breaches these terms or is used unlawfully.
        </p>
      </Section>

      <Section heading="Advertising">
        <p>
          <strong>Review.</strong> Every creative is reviewed before it airs. We may
          reject or remove anything unlawful, misleading, obscene, that infringes
          someone else&rsquo;s rights, that promotes prohibited goods or services, or
          that is unsafe to display to people in traffic. This decision is ours to
          make and we do not have to explain it.
        </p>
        <p>
          <strong>Your content.</strong> You confirm you hold the rights to everything
          you upload and grant us the licence needed to display it on the network for
          the duration of your campaign.
        </p>
        <p>
          <strong>Airtime.</strong> Each screen runs five advertising slots. A live
          campaign occupies one slot and appears once per rotation, regardless of how
          many files it contains; where a campaign has several files, they alternate
          between rotations. Slots are allocated by us, and we do not guarantee that
          a campaign will be placed on any particular vehicle, in any particular
          area, or at any particular time unless separately agreed in writing.
        </p>
        <p>
          <strong>Delivery.</strong> Screens depend on vehicles being in service and
          on mobile network coverage. We do not guarantee a minimum number of
          impressions, hours on screen, or geographic coverage.
        </p>
      </Section>

      <Section heading="Prices and payment">
        <p>
          Advertising runs on a prepaid balance. Credit is added to your account and
          drawn down as your ads play.
        </p>
        <p>
          Charging is per <strong>slot-hour</strong>: one campaign playing on one
          screen during one clock hour is charged once, however many times it looped
          in that hour. The price of a slot-hour is the base rate for your slot
          length (10, 20, or 30 seconds), adjusted for the district the screen was in
          and the time of day. Current rates are shown before you buy and in your
          billing history, where every charge is itemised with the rate and
          adjustments that produced it.
        </p>
        <p>
          When your balance reaches zero, your campaigns pause automatically and stop
          playing. They resume once credit is added. Unless required by law, prepaid
          credit is not refundable in cash, but any unused balance stays available
          for future campaigns. <em>[Confirm refund position with counsel and with
          your consumer-law obligations.]</em>
        </p>
        <p>
          We may change rates on <strong>[notice period]</strong> notice. Changes do
          not apply retroactively to airtime already delivered.
        </p>
      </Section>

      <Section heading="Fleet partners">
        <p>
          Fleet partners register their vehicles and carry a Gzad screen. The screen
          remains our property; it is installed, maintained, and removed by us or by
          someone we authorise. Do not modify, disable, obstruct, or move a screen,
          and do not interfere with what it reports.
        </p>
        <p>
          Screens report their position and what they played. That data determines
          both what advertisers pay and what partners are credited, so tampering with
          it is grounds for immediate termination.
        </p>
        <p>
          Partner compensation, payment schedule, and any minimum operating hours are
          set out in your separate partnership agreement.{' '}
          <em>[Attach or reference that agreement here.]</em>
        </p>
        <p>
          You are responsible for operating your vehicle lawfully, including any
          permits or vehicle-advertising rules that apply in your municipality.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          We aim to keep the service running but do not promise uninterrupted
          availability. Maintenance, network outages, hardware faults, and events
          outside our control can interrupt display. Where an interruption is our
          fault, our remedy is to credit the affected airtime back to your balance.
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          To the extent Georgian law permits, our total liability arising from these
          terms is limited to the amount you paid us in the three months before the
          claim, and we are not liable for lost profits, lost business, or indirect
          losses. Nothing here limits liability that cannot lawfully be limited.
        </p>
      </Section>

      <Section heading="Ending the relationship">
        <p>
          You may close your account at any time. We may suspend or terminate an
          account for breach of these terms, unlawful use, or non-payment. On
          termination, campaigns stop and screens are cleared.
        </p>
      </Section>

      <Section heading="Governing law">
        <p>
          These terms are governed by the law of Georgia, and disputes are subject to
          the courts of Tbilisi. <em>[Confirm forum and any arbitration preference
          with counsel.]</em>
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms and will revise the date at the top. Continued
          use after a change means acceptance; material changes will be communicated
          to account holders directly.
        </p>
      </Section>
    </LegalPage>
  )
}
