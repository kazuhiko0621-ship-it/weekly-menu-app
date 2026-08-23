import { useState } from 'react'
import PopularMeals from './PopularMeals.jsx'
import WishlistScreen from './WishlistScreen.jsx'

// 「献立アイディア」タブ。人気献立と食べたいリストをサブタブで切り替える。
export default function IdeasScreen({ onAddWishlistItem, onAdded, refreshKey }) {
  const [sub, setSub] = useState('popular') // 'popular' | 'wishlist'

  return (
    <div className="ideas-screen">
      <div className="m3-tabs">
        <button
          type="button"
          className={`m3-tab${sub === 'popular' ? ' selected' : ''}`}
          onClick={() => setSub('popular')}
        >
          人気献立
        </button>
        <button
          type="button"
          className={`m3-tab${sub === 'wishlist' ? ' selected' : ''}`}
          onClick={() => setSub('wishlist')}
        >
          食べたいリスト
        </button>
      </div>

      {sub === 'popular' && <PopularMeals onAdded={onAdded} />}
      {sub === 'wishlist' && (
        <WishlistScreen onAddNew={onAddWishlistItem} refreshKey={refreshKey} />
      )}
    </div>
  )
}
