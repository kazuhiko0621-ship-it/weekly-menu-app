import { useEffect, useRef, useState } from 'react'
import DayCard from './DayCard.jsx'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { getWeekDays, formatWeekRange, isToday } from '../utils/date.js'
import { fetchMealsForWeek, moveMealToDate } from '../utils/mealsApi.js'

const SWIPE_THRESHOLD = 50
// 横方向の移動量が縦方向より十分大きいときだけスワイプとみなす。
// iPhoneで下端までスクロールした際の弾み(バウンス)による
// わずかな横ブレを週送りと誤認しないようにするため。
const SWIPE_DIRECTION_RATIO = 1.5

export default function WeekView({ weekStart, onPrevWeek, onNextWeek, onEditDay, refreshKey }) {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragInfo, setDragInfo] = useState(null) // { mealId, fromDateKey, name, notion_url, x, y }
  const [hoverDateKey, setHoverDateKey] = useState(null)
  const touchStart = useRef(null)

  const days = getWeekDays(weekStart)
  const dateKeys = days.map((d) => d.dateKey)

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
      .then((data) => {
        if (!cancelled) setMeals(data)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), refreshKey])

  function onTouchStart(e) {
    if (dragInfo) return
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return
    if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) return // 縦スクロール優先

    if (deltaX > 0) onPrevWeek()
    else onNextWeek()
  }

  function handleGripPointerDown(e, meal) {
    e.preventDefault()
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    setDragInfo({
      mealId: meal.id,
      fromDateKey: meal.date,
      name: meal.name,
      notion_url: meal.notion_url,
      x: e.clientX,
      y: e.clientY,
    })
  }

  function handleGripPointerMove(e) {
    if (!dragInfo) return
    const x = e.clientX
    const y = e.clientY
    setDragInfo((prev) => (prev ? { ...prev, x, y } : prev))
    const el = document.elementFromPoint(x, y)
    const card = el && el.closest('[data-date-key]')
    setHoverDateKey(card ? card.getAttribute('data-date-key') : null)
  }

  async function handleGripPointerUp() {
    if (!dragInfo) return
    const info = dragInfo
    const target = hoverDateKey
    setDragInfo(null)
    setHoverDateKey(null)
    if (target && target !== info.fromDateKey) {
      await moveMealToDate(info.mealId, target)
      reload()
    }
  }

  return (
    <div className="week-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="week-nav">
        <button type="button" className="week-nav-btn" onClick={onPrevWeek} aria-label="前の週">
          ‹
        </button>
        <span className="week-range">{formatWeekRange(weekStart)}</span>
        <button type="button" className="week-nav-btn" onClick={onNextWeek} aria-label="次の週">
          ›
        </button>
      </div>

      {loading ? (
        <p className="loading-text">読み込み中…</p>
      ) : (
        <div className="day-list">
          {days.map((day) => (
            <DayCard
              key={day.dateKey}
              day={day}
              meals={meals.filter((m) => m.date === day.dateKey)}
              onEdit={onEditDay}
              isTodayFlag={isToday(day.dateKey)}
              isDropTarget={!!dragInfo && hoverDateKey === day.dateKey}
              onGripPointerDown={handleGripPointerDown}
              onGripPointerMove={handleGripPointerMove}
              onGripPointerUp={handleGripPointerUp}
            />
          ))}
        </div>
      )}

      {dragInfo && (
        <div className="drag-ghost" style={{ left: dragInfo.x, top: dragInfo.y }}>
          {dragInfo.notion_url ? <NotionIcon /> : <ManualIcon />}
          <span>{dragInfo.name}</span>
        </div>
      )}
    </div>
  )
}
