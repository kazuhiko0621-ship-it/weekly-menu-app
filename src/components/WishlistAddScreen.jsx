import { useEffect, useState } from 'react'
import SlotPanel from './SlotPanel.jsx'
import { fetchNotionMeta } from '../utils/notion.js'
import { insertWishlistItem } from '../utils/wishlistApi.js'

// 食べたいものリストへの新規登録画面。献立の入力画面とほぼ同じUIを再利用するが、
// 朝/昼/夜のような枠は無く、「各自」タブも不要なため非表示にしている。
export default function WishlistAddScreen({ onBack, onAdded }) {
  const [notionMeta, setNotionMeta] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchNotionMeta().then((meta) => !cancelled && setNotionMeta(meta))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="edit-screen">
      <div className="edit-screen-sticky">
        <div className="edit-screen-head">
          <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">
            ‹ 戻る
          </button>
          <span className="edit-screen-date">食べたいものを登録</span>
        </div>
      </div>

      <SlotPanel
        selectedMeal={null}
        notionMeta={notionMeta}
        showEachTab={false}
        onMessage={() => {}}
        onCommit={async (payload) => {
          await insertWishlistItem(payload)
        }}
        onCommitted={() => {
          onAdded()
          onBack()
        }}
      />
    </div>
  )
}
