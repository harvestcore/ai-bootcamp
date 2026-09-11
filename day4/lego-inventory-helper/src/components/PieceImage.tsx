import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'

/**
 * Real piece photos come from Rebrickable's CDN (their URL ships in the bundled
 * catalog, the bytes don't), so they need the network the first time. When
 * there's no photo on record — or loading it fails, e.g. offline before the
 * service worker ever cached it — this falls back to a generic brick
 * silhouette. No LEGO branding anywhere.
 */
export function PieceImage({
  imageUrl,
  size = 44,
  className,
}: {
  imageUrl: string | null
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  // A different piece (or a re-colored one) deserves a fresh attempt.
  useEffect(() => setFailed(false), [imageUrl])

  const showPhoto = imageUrl && !failed

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-sunken',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 fill-ink-muted/50" aria-hidden="true">
          <rect x="3" y="9" width="18" height="12" rx="1.5" />
          <rect x="6" y="4" width="4" height="5" rx="1" />
          <rect x="14" y="4" width="4" height="5" rx="1" />
        </svg>
      )}
    </span>
  )
}
