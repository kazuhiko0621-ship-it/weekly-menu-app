// 手入力(Notion未連携)の献立につけるアイコン。
// Notionアイコンと同じサイズで、鉛筆マークにして区別する。
export default function ManualIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="18" fill="#6b7a4f" />
      <path
        d="M30 62l4-16 28-28 12 12-28 28z"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M54 22l12 12" stroke="#fff" strokeWidth="6" />
      <path d="M30 62l16 4" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}
