'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/lib/i18n'
import { usePortalCapabilities } from './Capabilities'

export default function DailyCapControl({
  campaignId,
  dailyCap,
  status,
}: {
  campaignId: string
  dailyCap: number | string | null
  status: string
}) {
  const { t } = useTranslations()
  const p = t.portal.campaignDetail
  const [value, setValue] = useState(dailyCap == null ? '' : String(dailyCap))
  const [savedValue, setSavedValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<'saved' | 'error' | 'invalid' | null>(null)
  const { clientDailyLimits } = usePortalCapabilities()

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = value.trim()
    const cap = text === '' ? null : Number(text)
    if (cap !== null && (!/^\d+(?:\.\d{1,2})?$/.test(text) || !Number.isFinite(cap) || cap <= 0 || cap > 99999999.99)) {
      setMessage('invalid')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const { data, error } = await createClient().rpc('set_my_campaign_daily_cap', {
        p_campaign_id: campaignId,
        p_daily_cap: cap,
      })
      if (error || !data || data.daily_cap === undefined) throw error ?? new Error('No saved limit returned')
      const saved = data.daily_cap == null ? '' : String(data.daily_cap)
      setValue(saved)
      setSavedValue(saved)
      setMessage('saved')
    } catch {
      setMessage('error')
    } finally {
      setSaving(false)
    }
  }

  const error = message === 'error' || message === 'invalid'
  if (!clientDailyLimits) return null
  return (
    <section className="portal-section" aria-labelledby="daily-limit-title">
      <h2 id="daily-limit-title">{p.dailyLimitTitle}</h2>
      <form onSubmit={save} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12 }}>
        <div className="portal-input-group" style={{ flex: '1 1 240px', maxWidth: 400, margin: 0 }}>
          <label htmlFor="campaign-daily-limit">{p.dailyLimitLabel}</label>
          <input
            id="campaign-daily-limit"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            disabled={saving}
            aria-describedby="daily-limit-hint daily-limit-message"
            aria-invalid={error || undefined}
            onChange={event => { setValue(event.target.value); setMessage(null) }}
          />
        </div>
        <button type="submit" className="portal-btn-primary" disabled={saving || value === savedValue}>
          {saving ? p.dailyLimitSaving : p.dailyLimitSave}
        </button>
      </form>
      <p id="daily-limit-hint" style={{ margin: 0, fontSize: 13, color: 'var(--portal-text-soft)' }}>{p.dailyLimitHint}</p>
      {status === 'paused_cap' && <p className="portal-alert portal-alert-warning" style={{ margin: 0 }}>{p.dailyLimitPausedHint}</p>}
      <div id="daily-limit-message" role={error ? 'alert' : 'status'} aria-live="polite" style={{ fontSize: 13, color: error ? 'var(--portal-danger)' : 'var(--portal-success)' }}>
        {message === 'saved' ? p.dailyLimitSaved : message === 'invalid' ? p.dailyLimitInvalid : message === 'error' ? p.dailyLimitSaveError : null}
      </div>
    </section>
  )
}
