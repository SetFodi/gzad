import { Children, isValidElement } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { appFonts } from '@/app/fonts'
import '@/app/legal.css'

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  const headings = Children.toArray(children)
    .filter((child) => isValidElement<{ heading?: string }>(child) && typeof child.props.heading === 'string')
    .map((child) => (child as React.ReactElement<{ heading: string }>).props.heading)

  return (
    <div className="legal-page" style={appFonts} lang="en">
      <a href="#legal-content" className="legal-skip">Skip to content</a>
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" className="legal-logo" aria-label="Gzad home">
            <span className="legal-logo-mark" aria-hidden />
            gzad
          </Link>
          <Link href="/portal/login" className="legal-login">Log in</Link>
        </div>
      </header>

      <main id="legal-content" className="legal-main" tabIndex={-1}>
        <Link href="/" className="legal-back">
          <ArrowLeft size={15} aria-hidden /> Back to Gzad
        </Link>
        <div className="legal-title-block">
          <h1>{title}</h1>
          <p>Last updated: {lastUpdated}</p>
        </div>

        <div className="legal-document">
          <nav className="legal-contents" aria-label="On this page">
            <p>On this page</p>
            <ul>
              {headings.map((heading) => (
                <li key={heading}><a href={`#${sectionId(heading)}`}>{heading}</a></li>
              ))}
            </ul>
          </nav>
          <article className="legal-prose" aria-label={title}>{children}</article>
        </div>

        <footer className="legal-footer">
          <p>
            Questions about this page? Write to{' '}
            <a href="mailto:legal@gzad.ge">legal@gzad.ge</a>.
          </p>
          <nav aria-label="Legal">
            <Link href="/privacy" aria-current={title === 'Privacy Policy' ? 'page' : undefined}>Privacy Policy</Link>
            <Link href="/terms" aria-current={title === 'Terms of Service' ? 'page' : undefined}>Terms of Service</Link>
          </nav>
        </footer>
      </main>
    </div>
  )
}

const sectionId = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="legal-section" id={sectionId(heading)}>
      <h2>{heading}</h2>
      {children}
    </section>
  )
}
