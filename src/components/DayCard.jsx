import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { SLOTS } from '../utils/date.js'

// 1日分のカード(参照専用)。登録済みのコマだけ表示し、
// 同じコマに複数件登録されている場合はすべて表示する。
// Notion由来の献立名はレシピページへのリンクになる。
// 編集は「編集」ボタンから専用画面に遷移する。
export default function DayCard({ day, meals, onEdit, isTodayFlag }) {
  const mealsBySlot = {}
  for (const s of SLOTS) mealsBySlot[s.key] = []
  for (const m of meals) {
    if (mealsBySlot[m.slot]) mealsBySlot[m.slot].push(m)
  }
  const hasAny = meals.length > 0

  return (
    <div className={`day-card${isTodayFlag ? ' is-today' : ''}`}>
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
            const icon = m.notion_url ? <NotionIcon /> : <ManualIcon />
            return (
              <div key={m.id} className="day-card-row">
                <span className="slot-tag">{s.label}</span>
                <span className="meal-icon">{icon}</span>
                {m.notion_url ? (
                  <a className="meal-name meal-name-link" href={m.notion_url} target="_blank" rel="noreferrer">
                    {m.name}
                  </a>
                ) : (
                  <span className="meal-name">{m.name}</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
