'use client'

import { Fragment, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, ChevronDown, Mail } from 'lucide-react'
import { LanguageProvider, useTranslations } from '@/lib/i18n'
import ThemeSwitch from '@/components/app/ThemeSwitch'
import { LEGAL_EMAIL, LEGAL_UPDATED, legalDocuments, legalLabels, type LegalKind } from '@/content/legal'
import '@/app/legal.css'

/** The legal copy is trusted static text. Only links and emphasis are formatted. */
function InlineText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  const tokens = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]*)\)/g
  let start = 0
  for (const match of text.matchAll(tokens)) {
    nodes.push(text.slice(start, match.index))
    nodes.push(match[1]
      ? <strong key={match.index}>{match[1]}</strong>
      : <a key={match.index} href={match[3]}>{match[2]}</a>)
    start = match.index! + match[0].length
  }
  nodes.push(text.slice(start))
  return <>{nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>)}</>
}

function Document({ kind }: { kind: LegalKind }) {
  const { lang, setLang } = useTranslations()
  const document = legalDocuments[lang][kind]
  const labels = legalLabels[lang]
  const [contentsOpen, setContentsOpen] = useState(false)
  const sectionId = (id: string) => `${kind}-${id}`

  return (
    <div className="legal-page" lang={lang === 'ge' ? 'ka' : 'en'}>
      <a href="#legal-content" className="legal-skip">{labels.skip}</a>
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" className="legal-logo" aria-label={labels.home}>
            <span className="legal-logo-mark" aria-hidden />gzad
          </Link>
          <div className="legal-header-actions">
            <div className="legal-language" role="group" aria-label={labels.language}>
              <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
              <button type="button" lang="ka" aria-pressed={lang === 'ge'} onClick={() => setLang('ge')}>ქა</button>
            </div>
            <ThemeSwitch georgian={lang === 'ge'} />
            <Link href="/portal/login" className="legal-login">{labels.login}</Link>
          </div>
        </div>
      </header>

      <main id="legal-content" className="legal-main" tabIndex={-1}>
        <Link href="/" className="legal-back"><ArrowLeft size={15} aria-hidden />{labels.back}</Link>
        <div className="legal-title-block">
          <p className="legal-eyebrow">{document.eyebrow}</p>
          <h1>{document.title}</h1>
          <p className="legal-updated">{labels.updated}: <time dateTime={LEGAL_UPDATED}>{labels.date}</time></p>
        </div>
        <div className="legal-summary">
          <p>{document.summary}</p>
          <a href={`mailto:${LEGAL_EMAIL}`}><Mail size={16} aria-hidden />{LEGAL_EMAIL}<ArrowUpRight size={15} aria-hidden /></a>
        </div>

        <div className="legal-document">
          <nav className="legal-contents" aria-label={labels.contents}>
            <p>{labels.contents}</p>
            <button type="button" className="legal-contents-toggle" aria-expanded={contentsOpen} aria-controls="legal-sections" onClick={() => setContentsOpen(open => !open)}>
              {contentsOpen ? labels.hideContents : labels.showContents}<ChevronDown size={16} aria-hidden />
            </button>
            <ul id="legal-sections" data-open={contentsOpen || undefined}>
              {document.sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${sectionId(section.id)}`}><span aria-hidden>{String(index + 1).padStart(2, '0')}</span>{section.heading}</a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="legal-prose" aria-label={document.title}>
            <div className="legal-intro">{document.intro.map(text => <p key={text}><InlineText text={text} /></p>)}</div>
            {document.sections.map(section => (
              <section className="legal-section" id={sectionId(section.id)} key={section.id}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map(text => <p key={text}><InlineText text={text} /></p>)}
                {section.bullets && <ul>{section.bullets.map(text => <li key={text}><InlineText text={text} /></li>)}</ul>}
              </section>
            ))}
          </article>
        </div>

        <footer className="legal-footer">
          <div><p>{labels.contact}</p><a className="legal-contact" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}<ArrowUpRight size={15} aria-hidden /></a></div>
          <nav aria-label={labels.legal}>
            <Link href="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined}>{labels.privacy}</Link>
            <Link href="/terms" aria-current={kind === 'terms' ? 'page' : undefined}>{labels.terms}</Link>
            <Link href="/portal/login">{labels.login}</Link>
          </nav>
        </footer>
      </main>
    </div>
  )
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  return <LanguageProvider><Document kind={kind} /></LanguageProvider>
}
