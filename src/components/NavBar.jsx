export default function NavBar({ view, onChange }) {
  const items = [
    { key: 'week', label: '献立', icon: '📅' },
    { key: 'bento', label: '弁当', icon: '🍱' },
    { key: 'shopping', label: '買い物', icon: '🛒' },
    { key: 'ideas', label: 'アイディア', icon: '💡' },
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
