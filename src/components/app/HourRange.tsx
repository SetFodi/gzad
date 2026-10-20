'use client'

import { useId } from 'react'

/** Inclusive hours, from 0 through 23. Equal endpoints select one hour. */
export default function HourRange({
  start,
  end,
  onChange,
  label,
  fromLabel = 'Start hour',
  toLabel = 'End hour',
}: {
  start: number
  end: number
  onChange: (value: [number, number]) => void
  label: string
  fromLabel?: string
  toLabel?: string
}) {
  const id = useId()
  const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`

  return (
    <fieldset className="hour-range">
      <legend>{label}</legend>
      <div className="hour-range-field">
        <label htmlFor={`${id}-start`}>{fromLabel}</label>
        <input
          id={`${id}-start`}
          type="range"
          min={0}
          max={end}
          step={1}
          value={start}
          aria-valuetext={formatHour(start)}
          onChange={event => onChange([Math.min(Number(event.target.value), end), end])}
        />
        <output htmlFor={`${id}-start`}>{formatHour(start)}</output>
      </div>
      <div className="hour-range-field">
        <label htmlFor={`${id}-end`}>{toLabel}</label>
        <input
          id={`${id}-end`}
          type="range"
          min={start}
          max={23}
          step={1}
          value={end}
          aria-valuetext={formatHour(end)}
          onChange={event => onChange([start, Math.max(Number(event.target.value), start)])}
        />
        <output htmlFor={`${id}-end`}>{formatHour(end)}</output>
      </div>
    </fieldset>
  )
}
