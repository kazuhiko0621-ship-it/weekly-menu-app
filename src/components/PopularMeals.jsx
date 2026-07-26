import { useEffect, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import { fetchAllMeals, buildPopularRanking, insertMeal } from '../utils/mealsApi.js'
import { getWeekDays, SLOTS } from '../utils/date.js'

// 人気献立(登場回数の降順)。行を選ぶと今週の献立に追加できる
export default function PopularMeals({ weekStart, onAdded }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [openItem, setOpenItem] = useState(null) // name of item being added
  const [selectedDateKey, setSelectedDateKey] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState('dinner')
  const [saving, setSaving] = useState(false)

  const days = getWeekDays(weekStart)

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    fetchAllMeals()
      .then((all) => setRanking(buildPopularRanking(all)))
      .finally(() => setLoading(false))
  }

  function openPicker(item) {
    setOpenItem(item.name)
    setSelectedDateKey(days[0].dateKey)
    setSelectedSlot('dinner')
  }

  async function confirmAdd(item) {
    if (!selectedDateKey) return
    setSaving(true)
    try {
      await insertMeal({
        date: selectedDateKey,
        slot: selectedSlot,
        name: item.name,
        notion_page_id: item.notion_page_id,
        notion_url: item.notion_url,
        source: 'history',
      })
      setOpenItem(null)
      onAdded?.()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="loading-text">読み込み中…</p>
  if (ranking.length === 0) {
    return <p className="empty-text">まだ献立の記録がありません。今週の献立を登録すると、ここにランキングが表示されます。</p>
  }

  return (
    <div className="popular-list">
      {ranking.map((item, idx) => (
        <div className="popular-row" key={item.name}>
          <button type="button" className="popular-row-main" onClick={() => openPicker(item)}>
            <span className="popular-rank">{idx + 1}</span>
            <span className="popular-name">
              {item.name}
              {item.notion_url && (
                <a
                  className="notion-chip"
                  href={item.notion_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <NotionIcon />
                </a>
              )}
            </span>
            <span className="popular-count">{item.count}回</span>
            <span className="popular-lastdate">最終: {item.lastDate}</span>
          </button>

          {openItem === item.name && (
            <div className="popular-add-picker">
              <div className="picker-row">
                {days.map((d) => (
                  <button
                    type="button"
                    key={d.dateKey}
                    className={selectedDateKey === d.dateKey ? 'chip active' : 'chip'}
                    onClick={() => setSelectedDateKey(d.dateKey)}
                  >
                    {d.dowLabel}({d.date.getMonth() + 1}/{d.date.getDate()})
                  </button>
                ))}
              </div>
              <div className="picker-row">
                {SLOTS.map((s) => (
                  <button
                    type="button"
                    key={s.key}
                    className={selectedSlot === s.key ? 'chip active' : 'chip'}
                    onClick={() => setSelectedSlot(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="picker-actions">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => confirmAdd(item)}>
                  今週に追加
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setOpenItem(null)}>
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
