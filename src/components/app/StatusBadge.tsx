'use client'

import type { ReactNode } from 'react'
import { useTranslations } from '@/lib/i18n'
import { useAdminText } from '@/lib/admin-i18n'

/** Colour for a campaign or media status; one place for every page. */
export function statusTone(status: string): string {
  switch (status) {
    case 'active':
    case 'approved':
    case 'online':
      return 'var(--portal-success)'
    case 'pending_review':
    case 'paused_cap':
      return 'var(--portal-warning)'
    case 'paused_billing':
    case 'rejected':
    case 'offline':
      return 'var(--portal-danger)'
    case 'completed':
      return 'var(--portal-info)'
    default:
      return 'var(--portal-muted)'
  }
}

const ADMIN_LABELS: Record<string, string> = {
  active: 'Active',
  pending_review: 'Pending review',
  paused: 'Paused',
  paused_billing: 'Out of balance',
  paused_cap: 'Daily cap reached',
  completed: 'Completed',
  draft: 'Draft',
  approved: 'Approved',
  rejected: 'Rejected',
  deleted: 'Deleted',
}

/** English label for admin screens. */
export function adminStatusLabel(status: string): string {
  if (ADMIN_LABELS[status]) return ADMIN_LABELS[status]
  const words = status.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Localised campaign status label for the client portal. */
export function useStatusLabel() {
  const { t } = useTranslations()
  const c = t.portal.common
  return (status: string) => {
    const labels: Record<string, string> = {
      active: c.active,
      pending_review: c.pendingReview,
      paused: c.paused,
      paused_billing: c.pausedBilling,
      paused_cap: c.pausedCap,
      completed: c.completed,
    }
    const label = labels[status] ?? status.replace(/_/g, ' ')
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
}

export default function StatusBadge({
  status,
  children,
  tone,
}: {
  status: string
  /** Label; defaults to the admin label in the chosen language. */
  children?: ReactNode
  /** Overrides the colour picked from the status. */
  tone?: string
}) {
  const { t } = useAdminText()
  return (
    <span className="status-badge" style={{ color: tone ?? statusTone(status) }}>
      {children ?? t(adminStatusLabel(status))}
    </span>
  )
}
