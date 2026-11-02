// The Permit Search mark: a city hall inside a magnifying glass. Matches
// public/favicon.svg.
export function PermitSearchLogo({
  className = 'size-10',
}: {
  className?: string
}) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#302d2d" />
      <circle
        cx="29.5"
        cy="29.5"
        r="16"
        fill="none"
        stroke="#fdfff1"
        strokeWidth="3.5"
      />
      <path d="M21 26L29.5 20.5L38 26Z" fill="#fdfff1" />
      <path
        d="M23.5 28.5v7M29.5 28.5v7M35.5 28.5v7M21 37.5h17"
        stroke="#fdfff1"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M41.6 41.6L50.3 50.3"
        stroke="#fdfff1"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
