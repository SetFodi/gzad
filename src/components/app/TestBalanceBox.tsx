'use client'

import { useState, type FormEvent } from 'react'

// Admin-only box that sets an internal account's balance to an exact amount,
// so staff can test campaigns without real top-ups. The server only accepts it
// for accounts that billing never charges, so the amount stays put.

export interface TestBalanceLabels {
  title: string
  hint: string
  amount: string
  set: string
  /** Shown after saving; {amount} is replaced with the new balance. */
  done: string
  failed: string
}

interface Props {
  clientId: string
  labels: TestBalanceLabels
  onSaved?: (balance: number) => void
}

export default function TestBalanceBox({ clientId, labels, onSaved }: Props) {
  const [value, setValue] = useState('1000')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(value)
    if (value.trim() === '' || !Number.isFinite(amount) || amount < 0 || amount > 100_000) {
      setMessage({ ok: false, text: labels.failed })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, setTo: amount }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ ok: false, text: labels.failed })
        return
      }
      const balance = Number(result.balance)
      setMessage({ ok: true, text: labels.done.split('{amount}').join(`₾${balance.toFixed(2)}`) })
      onSaved?.(balance)
    } catch {
      setMessage({ ok: false, text: labels.failed })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="test-balance" onSubmit={submit}>
      <div className="test-balance-text">
        <strong>{labels.title}</strong>
        <small>{labels.hint}</small>
      </div>
      <div className="test-balance-row">
        <span aria-hidden>₾</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="100000"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={labels.amount}
        />
        <button type="submit" className="portal-btn-secondary" disabled={saving}>{labels.set}</button>
      </div>
      {message && (
        <p className="test-balance-note" role="status" data-ok={message.ok}>{message.text}</p>
      )}
    </form>
  )
}
