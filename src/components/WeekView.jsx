import { useEffect, useRef, useState } from 'react'
import DayCard from './DayCard.jsx'
import { getWeekDays, formatWeekRange, isToday } from '../utils/date.js'
import { fetchMealsForWeek } from '../utils/mealsApi.js'

const SWIPE_THRESHOLD = 50
// 横方向の移動量が縦方向より十分大きいときだけスワイプとみなす。
// iPhoneで下端までスクロールした際の弾み(バウンス)による
// わずかな横ブレを週送りと誤認しないようにするため。
const SWIPE_DIRECTION_RATIO = 1.5

export default function WeekView({ weekStart, onPrevWeek, onNextWeek, onEditDay, refreshKey }) {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const touchStart = useRef(null)

  const days = getWeekDays(weekStart)
  const dateKeys = days.map((d) => d.dateKey)

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
            />
          ))}
        </div>
      )}
    </div>
  )
}
