// シンプルな Notion アイコン(インラインSVG)
export default function NotionIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="18" fill="#000" />
      <path
        d="M32 30l30 2c3 0 4 2 4 4v34c0 2-1 3-3 3l-31-2c-3 0-4-2-4-5V33c0-2 1-3 4-3z"
        fill="none"
      />
      <text x="50" y="60" fontSize="42" fontFamily="Georgia, serif" fill="#fff" textAnchor="middle">
        N
      </text>
    </svg>
  )
}
