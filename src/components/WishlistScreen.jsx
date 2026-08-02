import { useEffect, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { DeleteIcon } from './ActionIcons.jsx'
import { SLOTS, toDateKey } from '../utils/date.js'
import { fetchWishlist, deleteWishlistItem } from '../utils/wishlistApi.js'
import { insertMeal } from '../utils/mealsApi.js'
import { mapsUrlForPlaceId } from '../utils/places.js'

// 食べたいものリスト。献立とは独立したリストで、人気献立の集計対象にもならない。
// 行を選ぶと日付・コマを指定して献立に追加できる(追加してもリストからは消えない)。
// 削除はゴミ箱アイコンからのみ行える。
export default function WishlistScreen({ onAddNew, refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [openItemId, setOpenItemId] = useState(null)
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [selectedSlot, setSelectedSlot] = useState('dinner')
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    fetchWishlist()
      .then((data) => setItems(data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [refreshKey])

  function openPicker(item) {
    setOpenItemId(item.id)
    setSelectedDateKey(toDateKey(new Date()))
    setSelectedSlot('dinner')
  }

  async function confirmAdd(item) {
    setSaving(true)
    try {
      await insertMeal({
        date: selectedDateKey,
        slot: selectedSlot,
        name: item.name,
        notion_page_id: item.notion_page_id,
        notion_url: item.notion_url,
        place_id: item.place_id,
        source: item.source,
      })
      setOpenItemId(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`「${item.name}」をリストから削除しますか？`)) return
    await deleteWishlistItem(item.id)
    load()
  }

  return (
    <div className="wishlist-view">
      {loading ? (
        <p className="loading-text">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="empty-text">まだ何も登録されていません。右下の「登録」から追加できます。</p>
      ) : (
        <div className="popular-list">
          {items.map((item) => {
            const isDining = item.source === 'dining'
            const linkUrl = item.notion_url || (isDining && item.place_id ? mapsUrlForPlaceId(item.place_id) : null)
            const icon = isDining ? '📍' : item.notion_url ? <NotionIcon /> : <ManualIcon />
            return (
              <div className="popular-row" key={item.id}>
                <div className="wishlist-row-main">
                  <button type="button" className="wishlist-row-tap" onClick={() => openPicker(item)}>
                    <span className="meal-icon">{icon}</span>
                    <span className="popular-name">
                      {item.name}
                      {linkUrl && (
                        <a
                          className="notion-chip"
                          href={linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          開く
                        </a>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => handleDelete(item)}
                    aria-label="リストから削除"
                  >
                    <DeleteIcon />
                  </button>
                </div>

                {openItemId === item.id && (
                  <div className="popular-add-picker">
                    <input
                      type="date"
                      className="date-input"
                      value={selectedDateKey}
                      onChange={(e) => setSelectedDateKey(e.target.value)}
                    />
                    <div className="picker-row">
                      {SLOTS.map((s) => (
                        <button
                          type="button"
                          key={s.key}
                          className={selectedSlot === s.key ? 'chip active' : 'chip'}
                          onClick={() => setSelectedSlot(s.key)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="picker-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => confirmAdd(item)}
                      >
                        この日に追加
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setOpenItemId(null)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="wishlist-add-btn-wrap">
        <button type="button" className="commit-btn" onClick={onAddNew}>
          登録
        </button>
      </div>
    </div>
  )
}
