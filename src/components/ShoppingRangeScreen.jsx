import { useState } from 'react'
import { toDateKey, addDays } from '../utils/date.js'
import { generateShoppingList, saveShoppingList } from '../utils/shoppingListApi.js'

export default function ShoppingRangeScreen({ defaultStart, defaultEnd, onBack, onGenerated }) {
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

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
        <span className="m3-top-app-bar-title">買い物リストを作る</span>
      </div>

      <div className="m3-content">
        <p className="m3-group-header">対象期間</p>
        <div className="m3-card m3-card-padded">
          <div className="m3-range-inputs">
            <input
              type="date"
              className="m3-text-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="m3-range-tilde">〜</span>
            <input
              type="date"
              className="m3-text-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <p className="m3-supporting-text">
          この期間の献立のうち、Notionのレシピから登録したものを対象に、
          レシピ材料明細から材料を集計します。外食・各自・手入力の献立は対象外です。
        </p>

        {error && <div className="m3-banner m3-banner-error">{error}</div>}

        <button type="button" className="m3-filled-button" disabled={generating} onClick={handleGenerate}>
          {generating ? '作成中…' : 'この期間で作成する'}
        </button>
      </div>
    </div>
  )
}

export function defaultRangeFromWeekStart(weekStart) {
  return {
    start: toDateKey(weekStart),
    end: toDateKey(addDays(weekStart, 13)),
  }
}
