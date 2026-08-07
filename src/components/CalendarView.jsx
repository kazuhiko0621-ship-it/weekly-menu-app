import { useEffect, useRef, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import GripIcon from './GripIcon.jsx'
import MessageModal from './MessageModal.jsx'
import { SLOTS, getTwoWeekDays, toDateKey, isToday } from '../utils/date.js'
import { fetchMealsForWeek, moveMealToDate, EACH_SOURCE } from '../utils/mealsApi.js'
import { mapsUrlForPlace } from '../utils/places.js'

const DOW_HEADERS = ['月', '火', '水', '木', '金', '土', '日']

// ドット色(朝=青/昼=橙/夜=赤紫)
const DOT_COLORS = ['#3a7bd5', '#e07820', '#b03060']

export default function CalendarView({ weekStart, onPrevWeek, onNextWeek, onEditDay, refreshKey }) {
  const days = getTwoWeekDays(weekStart)
  const dateKeys = days.map((d) => d.dateKey)

  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const today = toDateKey(new Date())
    return dateKeys.includes(today) ? today : dateKeys[0]
  })
  const [movingMeal, setMovingMeal] = useState(null) // { id, fromDateKey, name, notion_url }
  const [message, setMessage] = useState(null)
  const pressTimerRef = useRef(null)

  function reload() {
    setLoading(true)
    fetchMealsForWeek(dateKeys)
      .then((data) => setMeals(data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMealsForWeek(dateKeys)
      .then((data) => { if (!cancelled) setMeals(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), refreshKey])

  // weekStartが変わったとき、selectedDateKeyが範囲外なら先頭に補正
  useEffect(() => {
    if (!dateKeys.includes(selectedDateKey)) {
      setSelectedDateKey(dateKeys[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()])

  function startMove(meal) {
    setMovingMeal({ id: meal.id, fromDateKey: meal.date, name: meal.name, notion_url: meal.notion_url })
  }

  function cancelMove() {
    setMovingMeal(null)
  }

  async function confirmMove(targetDateKey) {
    if (!movingMeal || targetDateKey === movingMeal.fromDateKey) {
      cancelMove()
      return
    }
    await moveMealToDate(movingMeal.id, targetDateKey)
    setMovingMeal(null)
    setSelectedDateKey(targetDateKey)
    setMessage(`「${movingMeal.name}」を移動しました`)
    reload()
  }

  function handleCellClick(dateKey) {
    if (movingMeal) {
      confirmMove(dateKey)
    } else {
      setSelectedDateKey(dateKey)
    }
  }

  function handleGripPointerDown(e, meal) {
    e.preventDefault()
    clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => startMove(meal), 600)
  }

  function handleGripPointerUp() {
    clearTimeout(pressTimerRef.current)
  }

  const selectedDay = days.find((d) => d.dateKey === selectedDateKey)
  const mealsForSelected = meals.filter((m) => m.date === selectedDateKey)
  const mealsBySlot = {}
  for (const s of SLOTS) mealsBySlot[s.key] = []
  for (const m of mealsForSelected) {
    if (mealsBySlot[m.slot]) mealsBySlot[m.slot].push(m)
  }

  // カレンダーセルの合計献立数(ドット表示用)
  // 各セルに表示する献立名(朝→昼→夜の順で、そのコマの最初の1件を表示名として使う)
  function slotPreviewNames(dateKey) {
    const dayMeals = meals.filter((m) => m.date === dateKey)
    return SLOTS.map((s) => {
      const m = dayMeals.find((x) => x.slot === s.key)
      if (!m) return null
      if (m.source === EACH_SOURCE) return '各自'
      if (m.source === 'dining') return m.name.replace(/^外食:/, '')
      return m.name
    })
  }

  return (
    <div className="cal-view">
      {/* ── ミニカレンダー(2週分) ── */}
      <div className="cal-grid-wrap">
        <div className="cal-dow-row">
          {DOW_HEADERS.map((d, i) => (
            <div key={d} className={`cal-dow${i === 5 ? ' sat' : i === 6 ? ' sun' : ''}`}>{d}</div>
          ))}
        </div>
        {[0, 1].map((week) => (
          <div key={week} className="cal-week-row">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const names = slotPreviewNames(day.dateKey)
              const isSelected = day.dateKey === selectedDateKey
              const isTod = isToday(day.dateKey)
              const isMoveTarget = !!movingMeal && day.dateKey !== movingMeal.fromDateKey
              const isMoveFrom = movingMeal?.fromDateKey === day.dateKey
              const isSat = day.dowIndex === 5
              const isSun = day.dowIndex === 6
              return (
                <button
                  type="button"
                  key={day.dateKey}
                  className={[
                    'cal-cell',
                    isSelected && !movingMeal ? 'selected' : '',
                    isTod && !isSelected && !isMoveTarget ? 'today' : '',
                    isMoveTarget ? 'move-target' : '',
                    isMoveFrom ? 'move-from' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleCellClick(day.dateKey)}
                >
                  <span className={`cal-dn${isSat ? ' sat' : isSun ? ' sun' : ''}`}>
                    {day.date.getDate()}
                  </span>
                  <span className="cal-names">
                    {names.map((name, i) =>
                      name ? (
                        <span
                          key={i}
                          className="cal-name-line"
                          style={{ color: isSelected && !movingMeal ? '#fff' : DOT_COLORS[i] }}
                        >
                          {name}
                        </span>
                      ) : null
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {movingMeal && (
        <div className="move-hint-bar">
          <span>「{movingMeal.name}」の移動先をタップ</span>
          <button type="button" className="cancel-move-btn" onClick={cancelMove}>キャンセル</button>
        </div>
      )}

      {/* ── 選択日の献立詳細 ── */}
      <div className="cal-detail">
        {selectedDay && (
          <div className="cal-detail-head">
            <span className="cal-detail-date">
              {selectedDay.date.getMonth() + 1}/{selectedDay.date.getDate()}({selectedDay.dowLabel})
            </span>
            <button
              type="button"
              className="day-card-edit-btn"
              onClick={() => onEditDay(selectedDay)}
            >
              編集
            </button>
          </div>
        )}

        {loading ? (
          <p className="loading-text">読み込み中…</p>
        ) : (
          <div className="cal-slot-list">
            {SLOTS.map((s) => {
              const slotMeals = mealsBySlot[s.key] ?? []
              if (slotMeals.length === 0) {
                return (
                  <div key={s.key} className="cal-slot-empty-row">
                    <span className="slot-tag">{s.label}</span>
                    <span className="slot-empty-label">未登録</span>
                  </div>
                )
              }
              return slotMeals.map((m) => {
                const isEach = m.source === EACH_SOURCE
                const isDining = m.source === 'dining'
                const linkUrl = m.notion_url || (isDining && m.place_id ? mapsUrlForPlace(m.name, m.place_id) : null)
                const icon = isDining ? '📍' : m.notion_url ? <NotionIcon /> : <ManualIcon />
                const isMovingThis = movingMeal?.id === m.id
                return (
                  <div key={m.id} className={`cal-meal-row${isMovingThis ? ' is-moving' : ''}`}>
                    <span className="slot-tag">{s.label}</span>
                    {isEach ? (
                      <span className="meal-name meal-name-each">❌ 各自</span>
                    ) : (
                      <>
                        <span className="meal-icon">{icon}</span>
                        {linkUrl ? (
                          <a className="meal-name meal-name-link" href={linkUrl} target="_blank" rel="noreferrer">
                            {m.name}
                          </a>
                        ) : (
                          <span className="meal-name">{m.name}</span>
                        )}
                      </>
                    )}
                    {!isEach && (
                      <button
                        type="button"
                        className={`grip-handle${isMovingThis ? ' grip-active' : ''}`}
                        aria-label="長押しで別の日に移動"
                        onPointerDown={(e) => handleGripPointerDown(e, m)}
                        onPointerUp={handleGripPointerUp}
                        onPointerCancel={handleGripPointerUp}
                      >
                        <GripIcon />
                      </button>
                    )}
                  </div>
                )
              })
            })}
          </div>
        )}
      </div>

      <MessageModal message={message} onClose={() => setMessage(null)} />
    </div>
  )
}
