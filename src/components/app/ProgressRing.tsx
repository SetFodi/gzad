/** A small ring showing value out of max, with the percentage in the middle. */
export default function ProgressRing({
  value,
  max,
  size = 52,
  tone = 'var(--portal-primary)',
}: {
  value: number
  max: number
  size?: number
  tone?: string
}) {
  const stroke = 5
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} of ${max}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--portal-fill-strong)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * share} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="progress-ring-text">
        {Math.round(share * 100)}%
      </text>
    </svg>
  )
}
