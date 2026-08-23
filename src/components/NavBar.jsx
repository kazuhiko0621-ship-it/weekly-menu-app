export default function NavBar({ view, onChange }) {
  const items = [
    { key: 'week', label: '献立', icon: '📅' },
    { key: 'shopping', label: '買い物リスト', icon: '🛒' },
    { key: 'ideas', label: '献立アイディア', icon: '💡' },
  ]

  return (
    <nav className="nav-bar">
      {items.map((it) => (
        <button
          type="button"
          key={it.key}
          className={view === it.key ? 'nav-btn active' : 'nav-btn'}
          onClick={() => onChange(it.key)}
        >
          <span className="nav-icon">{it.icon}</span>
          <span className="nav-label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
