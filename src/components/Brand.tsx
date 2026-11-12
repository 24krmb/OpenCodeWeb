import { useId } from 'react'

type BrandMarkProps = {
  size?: number
  className?: string
  glow?: boolean
}

export function BrandMark({ size = 32, className = '', glow = false }: BrandMarkProps) {
  const gradientID = useId().replace(/:/g, '')
  return (
    <span
      className={`brand-mark ${glow ? 'brand-mark-glow' : ''} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={gradientID} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path
          d="M32 4 38.4 25.6 60 32 38.4 38.4 32 60 25.6 38.4 4 32 25.6 25.6Z"
          fill={`url(#${gradientID})`}
        />
        <circle cx="32" cy="32" r="5.2" fill="#070912" />
      </svg>
    </span>
  )
}

type BrandProps = {
  compact?: boolean
  subtitle?: string
}

export function Brand({ compact = false, subtitle = 'OPENCODE CONSOLE' }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`.trim()}>
      <BrandMark size={compact ? 30 : 38} glow />
      <div className="brand-copy">
        <span className="brand-word">YOULOGO</span>
        <span className="brand-sub">{subtitle}</span>
      </div>
    </div>
  )
}
