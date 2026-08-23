import { useState } from 'react'
import { toDateKey, getNextSundayFromToday } from '../utils/date.js'
import { generateShoppingList, saveShoppingList } from '../utils/shoppingListApi.js'

// 期間プリセット。今日を起点に「次の日曜日まで」「さらに次の日曜日まで」を選べる。
// 今日が土日の場合は、その週末ではなく翌週の日曜日が「次の日曜日」になる。
const PRESETS = [
  { key: 'thisWeek', label: '次の日曜日まで', weeksAhead: 0 },
  { key: 'nextWeek', label: 'さらに次の日曜日まで', weeksAhead: 1 },
]

export default function ShoppingRangeScreen({ onBack, onGenerated }) {
  const todayKey = toDateKey(new Date())
  const [preset, setPreset] = useState('thisWeek')
  const [startDate, setStartDate] = useState(todayKey)
  const [endDate, setEndDate] = useState(() => toDateKey(getNextSundayFromToday(0)))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  function applyPreset(p) {
    setPreset(p.key)
    setStartDate(todayKey)
    setEndDate(toDateKey(getNextSundayFromToday(p.weeksAhead)))
  }

  function handleManualDate(setter) {
    return (e) => {
      setter(e.target.value)
      setPreset('custom')
    }
  }

  async function handleGenerate() {
    if (generating) return
    if (startDate > endDate) {
      setError('開始日は終了日より前にしてください')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const result = await generateShoppingList(startDate, endDate)
      await saveShoppingList(startDate, endDate, result)
      onGenerated()
    } catch (e) {
      console.error(e)
      setError('作成に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="m3-screen">
      <div className="m3-top-app-bar">
        <button type="button" className="m3-icon-button" onClick={onBack} aria-label="戻る">←</button>
        <span className="m3-top-app-bar-title">献立から買い物リストを作る</span>
      </div>

      <div className="m3-content">
        <p className="m3-group-header">期間</p>
        <div className="m3-chip-wrap">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.key}
              className={`chip${preset === p.key ? ' active' : ''}`}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="m3-card m3-card-padded">
          <div className="m3-range-inputs">
            <input
              type="date"
              className="m3-text-field"
              value={startDate}
              onChange={handleManualDate(setStartDate)}
            />
            <span className="m3-range-tilde">〜</span>
            <input
              type="date"
              className="m3-text-field"
              value={endDate}
              onChange={handleManualDate(setEndDate)}
            />
          </div>
        </div>

        <p className="m3-supporting-text">
          この期間の献立のうち、Notionのレシピから登録したものを対象に、
          レシピ材料明細から材料を集計します。外食・各自・手入力の献立は対象外です。
          手動で追加した品は作り直しても消えません。
        </p>

        {error && <div className="m3-banner m3-banner-error">{error}</div>}

        <button type="button" className="m3-filled-button" disabled={generating} onClick={handleGenerate}>
          {generating ? '作成中…' : 'この期間で作成する'}
        </button>
      </div>
    </div>
  )
}
