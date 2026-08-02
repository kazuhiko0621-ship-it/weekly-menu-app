import { useEffect, useState } from 'react'
import SlotPanel from './SlotPanel.jsx'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { EditIcon, DeleteIcon } from './ActionIcons.jsx'
import MessageModal from './MessageModal.jsx'
import { SLOTS } from '../utils/date.js'
import { fetchMealsForWeek, deleteMeal, EACH_SOURCE } from '../utils/mealsApi.js'
import { fetchNotionMeta } from '../utils/notion.js'

// 献立入力画面。朝/昼/夜をタブで切り替え、
// ヘッダー・タブ・登録済み一覧は画面上部に固定し、
// 検索条件・検索結果だけがスクロールする。
export default function MealEditScreen({ day, onBack }) {
  const [activeSlot, setActiveSlot] = useState('breakfast')
  const [meals, setMeals] = useState([])
  const [notionMeta, setNotionMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedMealId, setSelectedMealId] = useState(null)
  const [message, setMessage] = useState(null)

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

  function changeSlot(slotKey) {
    setActiveSlot(slotKey)
    setSelectedMealId(null)
  }

  async function handleDelete(meal) {
    if (!window.confirm(`「${meal.name}」を削除しますか？`)) return
    await deleteMeal(meal)
    if (selectedMealId === meal.id) setSelectedMealId(null)
    setMessage('削除しました')
    reloadMeals()
  }

  const mealsForActiveSlot = meals.filter((m) => m.slot === activeSlot)
  const selectedMeal = mealsForActiveSlot.find((m) => m.id === selectedMealId) ?? null
  const activeSlotLabel = SLOTS.find((s) => s.key === activeSlot).label

  return (
    <div className="edit-screen">
      <div className="edit-screen-sticky">
        <div className="edit-screen-head">
          <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">
            ‹ 戻る
          </button>
          <span className="edit-screen-date">
            {day.date.getMonth() + 1}/{day.date.getDate()}({day.dowLabel})
          </span>
        </div>

        <div className="slot-tabs">
          {SLOTS.map((s) => {
            const count = meals.filter((m) => m.slot === s.key).length
            return (
              <button
                type="button"
                key={s.key}
                className={activeSlot === s.key ? 'slot-tab active' : 'slot-tab'}
                onClick={() => changeSlot(s.key)}
              >
                {s.label}
                <span className={`slot-tab-badge${count === 0 ? ' zero' : ''}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {mealsForActiveSlot.length > 0 && (
          <div className="registered-area">
            <p className="area-label">登録済み({activeSlotLabel})</p>
            {mealsForActiveSlot.map((m) => {
              const isEach = m.source === EACH_SOURCE
              return (
                <div key={m.id} className={`registered-row${selectedMealId === m.id ? ' selected' : ''}`}>
                  <span className="meal-icon">
                    {isEach ? '❌' : m.source === 'dining' ? '📍' : m.notion_url ? <NotionIcon /> : <ManualIcon />}
                  </span>
                  <span className="registered-name">{isEach ? '各自' : m.name}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setSelectedMealId(m.id)}
                    aria-label="更新する"
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => handleDelete(m)}
                    aria-label="削除する"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              )
            })}
            {selectedMealId && (
              <button type="button" className="cancel-update-btn" onClick={() => setSelectedMealId(null)}>
                更新をやめて新規登録に戻す
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="loading-text">読み込み中…</p>
      ) : (
        <SlotPanel
          key={activeSlot}
          slotKey={activeSlot}
          dateKey={day.dateKey}
          meals={mealsForActiveSlot}
          selectedMeal={selectedMeal}
          notionMeta={notionMeta}
          onMessage={setMessage}
          onCommitted={() => {
            setSelectedMealId(null)
            reloadMeals()
          }}
        />
      )}

      <MessageModal message={message} onClose={() => setMessage(null)} />
    </div>
  )
}
