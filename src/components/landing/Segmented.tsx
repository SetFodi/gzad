'use client'

/** A labelled radio group drawn as a segmented control. */
export default function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="lp-field">
      <span className="lp-field-label">{label}</span>
      <div className="lp-seg" role="radiogroup" aria-label={label} data-count={options.length}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
