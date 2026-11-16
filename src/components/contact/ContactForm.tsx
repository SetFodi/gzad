'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { CONTACT_LIMITS, CONTACT_TOPICS, type ContactField, type ContactTopic } from '@/lib/contact'
import { contactCopy } from './copy'
import './contact.css'

type Status = { kind: 'idle' | 'sending' } | { kind: 'sent'; name: string; email: string } | { kind: 'error'; text: string }

/** "Read our [Privacy policy](/privacy)." with the link rendered. */
function WithLink({ text }: { text: string }) {
  const match = /\[([^\]]+)\]\((\/[^)]*)\)/.exec(text)
  if (!match) return <>{text}</>
  return <>{text.slice(0, match.index)}<Link href={match[2]}>{match[1]}</Link>{text.slice(match.index + match[0].length)}</>
}

export default function ContactForm({ lang, initialTopic = 'quote' }: { lang: 'en' | 'ge'; initialTopic?: ContactTopic }) {
  const c = contactCopy[lang]
  const [topic, setTopic] = useState<ContactTopic>(initialTopic)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [invalid, setInvalid] = useState<ContactField | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const uid = useId()
  // Set when the form first renders, so the server can tell a person from a script.
  const [startedAt] = useState(() => Date.now())
  const [id, setId] = useState(() => crypto.randomUUID())

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '')
    setInvalid(null)
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: field('name'), email: field('email'), company: field('company'), phone: field('phone'),
          message: field('message'), website: field('website'), topic, lang, startedAt, id,
        }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; field?: ContactField }
      if (res.ok && data.ok) {
        setStatus({ kind: 'sent', name: field('name').trim(), email: field('email').trim() })
        return
      }
      if (data.error === 'INVALID' && data.field) {
        setInvalid(data.field)
        setStatus({ kind: 'error', text: c.errors[data.field] })
        formRef.current?.querySelector<HTMLElement>(`[name="${data.field}"]`)?.focus()
        return
      }
      setStatus({ kind: 'error', text: data.error === 'TOO_MANY' ? c.errors.TOO_MANY : c.errors.failed })
    } catch {
      setStatus({ kind: 'error', text: c.errors.failed })
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="cf cf-sent" role="status">
        <span className="cf-sent-mark" aria-hidden><Check size={22} /></span>
        <h3>{c.sentTitle}</h3>
        <p>{c.sentBody.replace('{name}', status.name).replace('{email}', status.email)}</p>
        <button type="button" className="cf-link" onClick={() => { setId(crypto.randomUUID()); setStatus({ kind: 'idle' }) }}>
          {c.another}
        </button>
      </div>
    )
  }

  const sending = status.kind === 'sending'
  const errorId = `${uid}-error`
  // The error message joins any hint the field already points to.
  const errorFor = (name: ContactField, hint?: string) => {
    const describedBy = [hint, invalid === name ? errorId : null].filter(Boolean).join(' ')
    return { 'aria-invalid': invalid === name || undefined, 'aria-describedby': describedBy || undefined }
  }

  return (
    <form ref={formRef} className="cf" onSubmit={submit}>
      <fieldset className="cf-topics">
        <legend>{c.topic}</legend>
        <div role="radiogroup" aria-label={c.topic}>
          {CONTACT_TOPICS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={topic === key} onClick={() => setTopic(key)}>
              {c.topics[key]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="cf-row">
        <div className="cf-field">
          <label htmlFor={`${uid}-name`}>{c.name}</label>
          <input id={`${uid}-name`} name="name" autoComplete="name" required maxLength={CONTACT_LIMITS.name} {...errorFor('name')} />
        </div>
        <div className="cf-field">
          <label htmlFor={`${uid}-email`}>{c.email}</label>
          <input id={`${uid}-email`} name="email" type="email" autoComplete="email" required maxLength={CONTACT_LIMITS.email} {...errorFor('email', `${uid}-email-hint`)} />
          <small id={`${uid}-email-hint`}>{c.emailHint}</small>
        </div>
      </div>
      <div className="cf-row">
        <div className="cf-field">
          <label htmlFor={`${uid}-company`}>{c.company} <em>{c.optional}</em></label>
          <input id={`${uid}-company`} name="company" autoComplete="organization" maxLength={CONTACT_LIMITS.company} {...errorFor('company')} />
        </div>
        <div className="cf-field">
          <label htmlFor={`${uid}-phone`}>{c.phone} <em>{c.optional}</em></label>
          <input id={`${uid}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={CONTACT_LIMITS.phone} {...errorFor('phone')} />
        </div>
      </div>
      <div className="cf-field">
        <label htmlFor={`${uid}-message`}>{c.message}</label>
        <textarea id={`${uid}-message`} name="message" rows={5} required minLength={2} maxLength={CONTACT_LIMITS.message} placeholder={c.placeholders[topic]} {...errorFor('message')} />
      </div>

      {/* Left empty by people; bots that fill every field are dropped. */}
      <label className="cf-trap" aria-hidden>
        Website <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {status.kind === 'error' && <p id={errorId} className="cf-error" role="alert">{status.text}</p>}

      <div className="cf-actions">
        <button type="submit" className="cf-submit" disabled={sending}>{sending ? c.sending : c.send}</button>
        <p className="cf-privacy"><WithLink text={c.privacy} /></p>
      </div>
    </form>
  )
}
