import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import GripIcon from './GripIcon.jsx'
import { SLOTS } from '../utils/date.js'
import { EACH_SOURCE } from '../utils/mealsApi.js'
import { mapsUrlForPlace } from '../utils/places.js'

// 1日分のカード(参照専用)。登録済みのコマだけ表示し、
// 同じコマに複数件登録されている場合はすべて表示する。
// Notion由来の献立名はレシピページへのリンクになる。
// 「各自」は献立名ではなく専用表示にする。
// つまみ(グリップ)をドラッグすると別の曜日に移動できる。
export default function DayCard({
  day,
  meals,
  onEdit,
  isTodayFlag,
  isDropTarget,
  onGripPointerDown,
  onGripPointerMove,
  onGripPointerUp,
}) {
  const mealsBySlot = {}
  for (const s of SLOTS) mealsBySlot[s.key] = []
  for (const m of meals) {
    if (mealsBySlot[m.slot]) mealsBySlot[m.slot].push(m)
  }
  const hasAny = meals.length > 0

  return (
    <div
      className={`day-card${isTodayFlag ? ' is-today' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
      data-date-key={day.dateKey}
    >
      <div className="day-card-head">
        <span className="day-card-dow">{day.dowLabel}</span>
        <span className="day-card-date">
          {day.date.getMonth() + 1}/{day.date.getDate()}
        </span>
        {isTodayFlag && <span className="day-card-today-badge">今日</span>}
        <button type="button" className="day-card-edit-btn" onClick={() => onEdit(day)}>
          編集
        </button>
      </div>

      <div className="day-card-body">
        {!hasAny && <p className="day-card-empty">登録なし</p>}
        {SLOTS.filter((s) => mealsBySlot[s.key].length > 0).map((s) =>
          mealsBySlot[s.key].map((m) => {
            const isEach = m.source === EACH_SOURCE
            const isDining = m.source === 'dining'
            const linkUrl = m.notion_url || (isDining && m.place_id ? mapsUrlForPlace(m.name, m.place_id) : null)
            const icon = isDining ? '📍' : m.notion_url ? <NotionIcon /> : <ManualIcon />
            return (
              <div key={m.id} className="day-card-row">
                <span className="slot-tag">{s.label}</span>
                {isEach ? (
                  <span className="meal-name meal-name-each">❌ 各自</span>
                ) : (
                  <>
                    <span className="meal-icon">{icon}</span>
                    {linkUrl ? (
                      <a
                        className="meal-name meal-name-link"
                        href={linkUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {m.name}
                      </a>
                    ) : (
                      <span className="meal-name">{m.name}</span>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="grip-handle"
                  aria-label="ドラッグして別の日に移動"
                  onPointerDown={(e) => onGripPointerDown(e, m)}
                  onPointerMove={onGripPointerMove}
                  onPointerUp={onGripPointerUp}
                  onPointerCancel={onGripPointerUp}
                >
                  <GripIcon />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
