'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Copy, X } from 'lucide-react'
import AppDialog from '@/components/app/AppDialog'
import { createClient } from '@/lib/supabase/client'
import { useAdminText } from '@/lib/admin-i18n'

interface Group { id: string; name: string }

/**
 * Adds a screen to the registry, then shows what to set in LEDOK. Opened with
 * setupFor, it skips the form and shows the steps for a screen already added.
 */
export default function AddScreenDialog({ setupFor, initialCardId, address, onClose, onAdded }: {
  setupFor?: string | null
  /** Filled in for a screen that is already asking to join. */
  initialCardId?: string
  address: string | null
  onClose: () => void
  onAdded: () => void
}) {
  const { t } = useAdminText()
  const [cardId, setCardId] = useState(initialCardId ?? '')
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<{ cardId: string; address: string | null } | null>(
    setupFor ? { cardId: setupFor, address } : null,
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (setupFor) return
    createClient()
      .from('device_groups')
      .select('id, name')
      .order('name')
      .then(({ data }) => setGroups(data ?? []))
  }, [setupFor])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, name, groupId: groupId || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(t(typeof data.error === 'string' ? data.error : 'Could not add the screen'))
        return
      }
      setAdded({ cardId: data.cardId, address: data.address ?? address })
      onAdded()
    } catch {
      setError(t('Could not add the screen'))
    } finally {
      setSaving(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // The text stays visible to select by hand.
    }
  }

  return (
    <AppDialog labelledBy="add-screen-title" onClose={onClose}>
      <div className="admin-modal-header">
        <h2 id="add-screen-title">{added && !initialCardId ? t('Set up {id} in LEDOK', { id: added.cardId }) : t('Add a screen')}</h2>
        <button type="button" onClick={onClose} className="admin-modal-close" aria-label={t('Close')}><X size={20} /></button>
      </div>

      {added && initialCardId ? (
        // It was already knocking with the right address: nothing to set up.
        <div className="portal-form">
          <p className="setup-done">{t('{id} is added. It already has the server address, so it connects on its next try, usually within a minute.', { id: added.cardId })}</p>
          <button type="button" onClick={onClose} className="portal-btn-primary full-width">{t('Got it')}</button>
        </div>
      ) : added ? (
        <div className="portal-form">
          <ol className="setup-steps">
            <li>{t('Connect the laptop to the screen’s WiFi and open LEDOK Express.')}</li>
            <li>{t('Select the screen, open Advanced and enter the password 888.')}</li>
            <li>
              {t('Paste this into “Realtime (Plat 4) Address” and press Set:')}
              {added.address ? (
                <div className="setup-address">
                  <code>{added.address}</code>
                  <button type="button" className="action-btn" onClick={() => copy(added.address!)}>
                    {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? t('Copied') : t('Copy')}
                  </button>
                </div>
              ) : (
                <p className="field-hint">{t('The Realtime Server didn’t send the address. Use the one your other screens have.')}</p>
              )}
            </li>
            <li>{t('Once the screen has mobile data, it shows as Online here within a minute and starts its group’s ads.')}</li>
          </ol>
          <button type="button" onClick={onClose} className="portal-btn-primary full-width">{t('Got it')}</button>
        </div>
      ) : (
        <form className="portal-form" onSubmit={submit}>
          {error && <div className="portal-login-error" role="alert">{error}</div>}
          <div className="portal-input-group">
            <label htmlFor="add-screen-id">{t('Screen ID')}</label>
            <input
              id="add-screen-id"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="y08-s26-60755"
              autoComplete="off"
              spellCheck={false}
              required
              autoFocus={!initialCardId}
              readOnly={Boolean(initialCardId)}
            />
            <span className="field-hint">{t('As LEDOK shows it in the Terminals list.')}</span>
          </div>
          <div className="portal-input-group">
            <label htmlFor="add-screen-name">{t('Name (optional)')}</label>
            <input
              id="add-screen-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Taxi #2')}
              maxLength={80}
            />
          </div>
          <div className="portal-input-group">
            <label htmlFor="add-screen-group">{t('Group')}</label>
            <select id="add-screen-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{t('No group yet (shows no ads)')}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving || !cardId.trim()} className="portal-btn-primary full-width">
            {saving ? t('Adding…') : t('Add screen')}
          </button>
        </form>
      )}
    </AppDialog>
  )
}
