// 献立行のドラッグ用ハンドル(縦6点アイコン)
export default function GripIcon({ size = 16 }) {
  const dots = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      dots.push(<circle key={`${row}-${col}`} cx={8 + col * 8} cy={4 + row * 8} r="2" fill="currentColor" />)
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {dots}
    </svg>
  )
}
