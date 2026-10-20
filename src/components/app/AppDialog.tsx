'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Native modal behavior keeps focus, Escape dismissal, and restoration shared. */
export default function AppDialog({ children, labelledBy, onClose }: {
  children: ReactNode
  labelledBy: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // Capture before children mount: their autoFocus can replace the opener.
  const [opener] = useState(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previous
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])

  return (
    <dialog
      ref={ref}
      className="admin-modal"
      aria-labelledby={labelledBy}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
    >
      {children}
    </dialog>
  )
}
