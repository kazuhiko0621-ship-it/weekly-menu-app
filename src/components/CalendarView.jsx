import { useEffect, useRef, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import GripIcon from './GripIcon.jsx'
import MessageModal from './MessageModal.jsx'
import { SLOTS, getTwoWeekDays, toDateKey, isToday } from '../utils/date.js'
import { fetchMealsForWeek, moveMealTo, EACH_SOURCE } from '../utils/mealsApi.js'
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
  const [movingMeal, setMovingMeal] = useState(null) // { id, fromDateKey, fromSlot, name, notion_url }
  // 移動先として選ばれた日付(未選択なら移動元と同じ日=コマだけ変える操作)
  const [moveTargetDate, setMoveTargetDate] = useState(null)
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
    setMovingMeal({
      id: meal.id,
      fromDateKey: meal.date,
      fromSlot: meal.slot,
      name: meal.name,
      notion_url: meal.notion_url,
    })
    setMoveTargetDate(meal.date)
  }

  function cancelMove() {
    setMovingMeal(null)
    setMoveTargetDate(null)
  }

  // 移動を確定する。日付は moveTargetDate、コマは引数で受け取る。
  async function confirmMove(targetSlot) {
    if (!movingMeal) return
    const targetDate = moveTargetDate ?? movingMeal.fromDateKey
    if (targetDate === movingMeal.fromDateKey && targetSlot === movingMeal.fromSlot) {
      cancelMove()
      return
    }
    await moveMealTo(movingMeal.id, targetDate, targetSlot)
    const label = SLOTS.find((s) => s.key === targetSlot)?.label ?? ''
    setMovingMeal(null)
    setMoveTargetDate(null)
    setSelectedDateKey(targetDate)
    setMessage(`「${movingMeal.name}」を${label}に移動しました`)
    reload()
  }

  function handleCellClick(dateKey) {
    if (movingMeal) {
      // 移動モード中は、日付をタップすると移動先の日付が切り替わる(確定はコマ選択で行う)
      setMoveTargetDate(dateKey)
    } else {
      setSelectedDateKey(dateKey)
    }
  }

  function handleGripPointerDown(e, meal) {
    // iOSの長押しメニュー(コピー/選択)やスクロール開始を抑止する
    e.preventDefault()
    e.stopPropagation()
    clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => startMove(meal), 600)
  }

  function handleGripPointerUp() {
    clearTimeout(pressTimerRef.current)
  }

  // 長押し待機中に指が動いた場合はスクロール操作とみなして中断する
  function handleGripPointerMove() {
    clearTimeout(pressTimerRef.current)
  }

  // 長押しでコンテキストメニューが出るのを止める
  function handleGripContextMenu(e) {
    e.preventDefault()
  }

  const moveTargetDay = days.find((d) => d.dateKey === moveTargetDate)
  const moveTargetDateLabel = moveTargetDay
    ? `${moveTargetDay.date.getMonth() + 1}/${moveTargetDay.date.getDate()}(${moveTargetDay.dowLabel})`
    : ''

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
              const isMoveTarget = !!movingMeal && day.dateKey === moveTargetDate
              const isMoveFrom = !!movingMeal && movingMeal.fromDateKey === day.dateKey && day.dateKey !== moveTargetDate
              const isMoveCandidate = !!movingMeal && !isMoveTarget && !isMoveFrom
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
                    isMoveCandidate ? 'move-candidate' : '',
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
        <>
          <div className="move-hint-bar">
            <span>「{movingMeal.name}」の移動先を選択</span>
            <button type="button" className="cancel-move-btn" onClick={cancelMove}>キャンセル</button>
          </div>

          {/* 移動先のコマを選ぶ。日付はカレンダーで切り替えられる */}
          <div className="move-slot-panel">
            <p className="move-slot-date">
              {moveTargetDateLabel}
              {moveTargetDate !== movingMeal.fromDateKey && <span className="move-slot-badge">日付変更</span>}
            </p>
            <div className="move-slot-buttons">
              {SLOTS.map((s) => {
                const isSameSpot =
                  moveTargetDate === movingMeal.fromDateKey && s.key === movingMeal.fromSlot
                return (
                  <button
                    type="button"
                    key={s.key}
                    className={`move-slot-btn${isSameSpot ? ' current' : ''}`}
                    onClick={() => confirmMove(s.key)}
                  >
                    {s.label}ごはんに変更
                    {isSameSpot && <span className="move-slot-note">(現在)</span>}
                  </button>
                )
              })}
            </div>
            <p className="move-slot-hint">別の日に移す場合は、上のカレンダーで日付を選んでください</p>
          </div>
        </>
      )}

      {/* ── 選択日の献立詳細 ── */}
      {!movingMeal && (
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
                        onPointerMove={handleGripPointerMove}
                        onContextMenu={handleGripContextMenu}
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
      )}

      <MessageModal message={message} onClose={() => setMessage(null)} />
    </div>
  )
}
