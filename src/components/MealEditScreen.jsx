import { useEffect, useState } from 'react'
import SlotPanel from './SlotPanel.jsx'
import { SLOTS } from '../utils/date.js'
import { fetchMealsForWeek } from '../utils/mealsApi.js'
import { fetchNotionMeta } from '../utils/notion.js'

// 献立入力画面。朝/昼/夜をタブで切り替え、
// 1つのコマにつき登録済み一覧・検索条件・検索結果の3エリアで編集する。
export default function MealEditScreen({ day, onBack }) {
  const [activeSlot, setActiveSlot] = useState('breakfast')
  const [meals, setMeals] = useState([])
  const [notionMeta, setNotionMeta] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchNotionMeta().then((meta) => !cancelled && setNotionMeta(meta))
    return () => {
      cancelled = true
    }
  }, [])

  function reloadMeals() {
    setLoading(true)
    fetchMealsForWeek([day.dateKey]).then((m) => {
      setMeals(m)
      setLoading(false)
    })
  }

  useEffect(() => {
    reloadMeals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.dateKey])

  const mealsForActiveSlot = meals.filter((m) => m.slot === activeSlot)

  return (
    <div className="edit-screen">
      <div className="edit-screen-head">
        <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">
          ‹ 戻る
        </button>
        <span className="edit-screen-date">
          {day.date.getMonth() + 1}/{day.date.getDate()}({day.dowLabel})
        </span>
      </div>

      <div className="slot-tabs">
        {SLOTS.map((s) => (
          <button
            type="button"
            key={s.key}
            className={activeSlot === s.key ? 'slot-tab active' : 'slot-tab'}
            onClick={() => setActiveSlot(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading-text">読み込み中…</p>
      ) : (
        <SlotPanel
          key={activeSlot}
          slotLabel={SLOTS.find((s) => s.key === activeSlot).label}
          slotKey={activeSlot}
          dateKey={day.dateKey}
          meals={mealsForActiveSlot}
          notionMeta={notionMeta}
          onChanged={reloadMeals}
        />
      )}
    </div>
  )
}
