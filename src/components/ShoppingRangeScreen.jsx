import { useState } from 'react'
import { toDateKey, addDays } from '../utils/date.js'
import { generateShoppingList, saveShoppingList } from '../utils/shoppingListApi.js'

// 買い物リストの生成範囲(開始日・終了日)を選ぶ画面
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
    <div className="edit-screen">
      <div className="edit-screen-sticky">
        <div className="edit-screen-head">
          <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">
            ‹ 戻る
          </button>
          <span className="edit-screen-date">買い物リストを作る</span>
        </div>
      </div>

      <div className="range-picker-body">
        <p className="area-label">対象期間</p>
        <div className="range-inputs">
          <input
            type="date"
            className="date-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="range-tilde">〜</span>
          <input
            type="date"
            className="date-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <p className="range-hint">
          この期間に登録されている、Notionのレシピから作った献立の材料を集計します。
          「外食」「各自」「手入力」の献立は対象外です。
        </p>

        {error && <p className="login-error">{error}</p>}

        <button type="button" className="btn btn-primary" disabled={generating} onClick={handleGenerate}>
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
