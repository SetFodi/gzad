import type { Metadata } from 'next'
import LegalPage, { Section } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy | Gzad',
  description: 'How Gzad collects and uses personal data, including vehicle location data.',
}

// DRAFT — written to describe what the system actually does, not vetted by a
// lawyer. Gzad processes vehicle location data continuously and holds driver
// and vehicle records, which brings it under Georgia's Law on Personal Data
// Protection. Have a Georgian data-protection lawyer review this, fill in the
// operator details below, and confirm whether a Data Protection Officer must be
// designated before you rely on it.
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="7 August 2026">
      <p>
        This policy explains what personal data Gzad collects, why, and what you can
        do about it. It covers our website, the advertiser portal, the fleet portal,
        and the advertising screens installed in partner vehicles.
      </p>

      <Section heading="Who is responsible">
        <p>
          The data controller is <strong>[legal entity name]</strong>, identification
          number <strong>[ID number]</strong>, registered at{' '}
          <strong>[registered address], Tbilisi, Georgia</strong>. Contact us at{' '}
          <a href="mailto:legal@gzad.ge" className="underline">legal@gzad.ge</a>.
        </p>
      </Section>

      <Section heading="What we collect">
        <p><strong>Account data.</strong> Name, email address, phone number, company
        name, and role, provided when an account is created.</p>

        <p><strong>Advertising content.</strong> Images and videos uploaded by
        advertisers, along with campaign names and schedules.</p>

        <p><strong>Vehicle and device data.</strong> For fleet partners: vehicle make,
        model, year, colour, and licence plate, plus the identifier of the screen
        installed in that vehicle.</p>

        <p><strong>Location data.</strong> Screens report their GPS position
        alongside each advertisement they play, roughly every few minutes while the
        vehicle is operating. Because a screen is assigned to a specific vehicle and
        a vehicle to a specific fleet partner, this location history is personal data
        relating to that partner and their drivers.</p>

        <p><strong>Playback records.</strong> Which advertisement played, on which
        screen, when, for how long, and where.</p>

        <p><strong>Billing records.</strong> Balance movements, charges, and the
        pricing applied to each charge.</p>
      </Section>

      <Section heading="Why we use it">
        <p>
          To operate the service: deciding which advertisements a screen should show,
          and keeping accounts and vehicles in order.
        </p>
        <p>
          To bill accurately: charges are calculated from playback records and the
          district a screen was in, so location and playback data directly determine
          what an advertiser pays and what a fleet partner is credited for.
        </p>
        <p>
          To report to advertisers: aggregate coverage and impression statistics.
          Advertisers see where and when their own campaigns played; they do not see
          which vehicle, driver, or fleet partner was involved.
        </p>
        <p>
          To keep the network secure: detecting tampering with screens and fraudulent
          playback reporting.
        </p>
        <p>
          Our legal basis is performance of the contract with advertisers and fleet
          partners, and our legitimate interest in billing correctly and preventing
          fraud. <em>[Confirm with counsel whether a separate written consent from
          drivers is required for continuous vehicle tracking under Georgian law.]</em>
        </p>
      </Section>

      <Section heading="Who can see what">
        <p>
          Fleet partners see data for their own vehicles only. Advertisers see
          statistics for their own campaigns only, never identifying a vehicle or
          driver. Gzad staff can see all records in order to run the service.
        </p>
        <p>
          We do not sell personal data. We share it only with the infrastructure
          providers that run the service on our behalf — Supabase (database, file
          storage, authentication) and Vercel (application hosting) — and where the
          law requires disclosure.
        </p>
        <p>
          Uploaded advertising media is served from a publicly readable address so
          that screens can fetch it. Do not upload anything to the platform that you
          would not want to be publicly accessible.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Playback and location records are retained for <strong>[retention period —
          decide this; 24 months is a common choice for billing disputes]</strong>.
          Billing records are retained for as long as accounting law requires.
          Account data is kept while the account is open and for a reasonable period
          afterwards. Advertising media is deleted on request once the campaign has
          ended.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You may request access to your personal data, correction of inaccurate
          data, deletion, restriction of processing, or a copy in a portable format,
          and you may object to processing based on legitimate interest. Write to{' '}
          <a href="mailto:legal@gzad.ge" className="underline">legal@gzad.ge</a> and
          we will respond within the period the law allows.
        </p>
        <p>
          If you believe we have handled your data improperly, you may complain to
          the Personal Data Protection Service of Georgia.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          Access to the platform requires authentication, and the database enforces
          per-account separation so one account cannot read another&rsquo;s data.
          Each screen authenticates with its own credential, so a tampered device
          cannot report on behalf of others. No system is perfectly secure; tell us
          promptly at{' '}
          <a href="mailto:legal@gzad.ge" className="underline">legal@gzad.ge</a> if
          you think an account has been compromised.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We will update this page when our practices change and revise the date at
          the top. Material changes will be communicated to account holders directly.
        </p>
      </Section>
    </LegalPage>
  )
}
