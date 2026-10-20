'use client'

/**
 * A taxi-top screen showing the chosen file the way the panel does: 3:1,
 * edge to edge, under the LED dot grid (240 × 80 per side).
 */
export default function ScreenPreview({
  src,
  isVideo,
  emptyLabel,
}: {
  src?: string
  isVideo?: boolean
  emptyLabel: string
}) {
  return (
    <figure className="screen-preview">
      <div className="screen-preview-body">
        <div className="screen-preview-panel">
          {src ? (
            isVideo ? (
              <video key={src} src={src} muted autoPlay loop playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" />
            )
          ) : (
            <span className="screen-preview-empty">{emptyLabel}</span>
          )}
          <span className="screen-preview-pixels" aria-hidden />
        </div>
      </div>
      <div className="screen-preview-mounts" aria-hidden>
        <span />
        <span />
      </div>
    </figure>
  )
}
