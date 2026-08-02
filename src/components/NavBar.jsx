export default function NavBar({ view, onChange }) {
  return (
    <nav className="nav-bar">
      <button
        type="button"
        className={view === 'week' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onChange('week')}
      >
        今週の献立
      </button>
      <button
        type="button"
        className={view === 'popular' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onChange('popular')}
      >
        人気献立
      </button>
      <button
        type="button"
        className={view === 'wishlist' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onChange('wishlist')}
      >
        食べたいリスト
      </button>
    </nav>
  )
}
