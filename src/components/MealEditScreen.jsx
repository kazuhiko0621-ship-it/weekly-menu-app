import { useEffect, useState } from 'react'
import SlotEditor from './SlotEditor.jsx'
import { SLOTS } from '../utils/date.js'
import { fetchMealsForWeek, upsertMeal } from '../utils/mealsApi.js'
import { fetchNotionMeta } from '../utils/notion.js'

// 献立入力画面(曜日ごとの朝/昼/夜をまとめて編集する専用画面)
export default function MealEditScreen({ day, onBack, bumpRefresh }) {
  const [meals, setMeals] = useState([])
  const [notionMeta, setNotionMeta] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchMealsForWeek([day.dateKey]), fetchNotionMeta()]).then(([m, meta]) => {
      if (cancelled) return
      setMeals(m)
      setNotionMeta(meta)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [day.dateKey])

  const mealBySlot = Object.fromEntries(meals.map((m) => [m.slot, m]))

  async function handleSave(slot, payload) {
    const saved = await upsertMeal({ date: day.dateKey, slot, ...payload })
    setMeals((prev) => [...prev.filter((m) => m.slot !== slot), ...(saved ? [saved] : [])])
    bumpRefresh()
  }

  async function handleClear(slot) {
    await upsertMeal({ date: day.dateKey, slot, name: '' })
    setMeals((prev) => prev.filter((m) => m.slot !== slot))
    bumpRefresh()
  }

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

      {loading ? (
        <p className="loading-text">読み込み中…</p>
      ) : (
        <div className="edit-screen-body">
          {SLOTS.map((s) => (
            <SlotEditor
              key={s.key}
              slotLabel={s.label}
              meal={mealBySlot[s.key] ?? null}
              notionMeta={notionMeta}
              onSave={(payload) => handleSave(s.key, payload)}
              onClear={() => handleClear(s.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
