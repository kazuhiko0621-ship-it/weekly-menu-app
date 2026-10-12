import { useEffect, useRef, useState } from 'react'
import { DeleteIcon } from './ActionIcons.jsx'
import {
  fetchBentoStock,
  consumeBentoLot,
  undoConsumeBentoLot,
  deleteBentoLot,
  daysSince,
  formatMadeOn,
  STALE_DAYS,
} from '../utils/bentoApi.js'

// 弁当在庫の一覧(サブタブ1)。ロット単位で表示し、1食ずつ消費できる。
export default function BentoStockList({ refreshKey, onSummaryChange, onConsumed }) {
  const [lots, setLots] = useState(undefined)
  const [busyId, setBusyId] = useState(null)
  const [undoLot, setUndoLot] = useState(null)
  const toastTimer = useRef(null)

  function load() {
    fetchBentoStock()
      .then(setLots)
      .catch(() => setLots([]))
  }

  useEffect(load, [refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (!lots) return
    const total = lots.reduce((n, l) => n + l.remaining, 0)
    onSummaryChange?.({ total, lots: lots.length })
  }, [lots, onSummaryChange])

  function showUndo(lot) {
    setUndoLot(lot)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setUndoLot(null), 5000)
  }

  async function handleConsume(lot) {
    if (busyId) return
    setBusyId(lot.id)
    // 画面を先に更新して、タップの手応えを早くする
    setLots((prev) =>
      prev
        .map((l) => (l.id === lot.id ? { ...l, remaining: l.remaining - 1 } : l))
        .filter((l) => l.remaining > 0)
    )
    try {
      const res = await consumeBentoLot(lot)
      if (res) {
        showUndo({ ...lot, logId: res.log?.id })
        onConsumed?.()
      } else {
        load()
      }
    } catch {
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleUndo() {
    if (!undoLot) return
    const target = undoLot
    setUndoLot(null)
    clearTimeout(toastTimer.current)
    try {
      await undoConsumeBentoLot({ ...target, remaining: target.remaining - 1 }, target.logId)
      onConsumed?.()
    } finally {
      load()
    }
  }

  async function handleDelete(lot) {
    if (!window.confirm(`「${lot.name}」(${formatMadeOn(lot.made_on)}作成)のロットを削除しますか？`))
      return
    setLots((prev) => prev.filter((l) => l.id !== lot.id))
    try {
      await deleteBentoLot(lot.id)
    } finally {
      load()
    }
  }

  if (lots === undefined) return <p className="m3-empty">読み込み中…</p>

  if (lots.length === 0) {
    return (
      <p className="m3-empty">
        在庫はありません。
        <br />
        「作りおき登録」から追加してください。
      </p>
    )
  }

  return (
    <div className="bento-list">
      {lots.map((lot) => {
        const days = daysSince(lot.made_on)
        const stale = days >= STALE_DAYS
        return (
          <div key={lot.id} className={`bento-lot${stale ? ' stale' : ''}`}>
            <div className="bento-lot-main">
              {lot.notion_url ? (
                <a
                  className="bento-name bento-name-link"
                  href={lot.notion_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lot.name}
                </a>
              ) : (
                <span className="bento-name">{lot.name}</span>
              )}
              <span className="bento-meta">
                {formatMadeOn(lot.made_on)}・{days}日{stale ? '(3週超)' : ''}・作{lot.made_count}
              </span>
            </div>
            <span className="bento-qty">{lot.remaining}食</span>
            <button
              type="button"
              className="bento-eat"
              disabled={busyId === lot.id}
              onClick={() => handleConsume(lot)}
            >
              消費
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger icon-btn-sm"
              onClick={() => handleDelete(lot)}
              aria-label="このロットを削除"
            >
              <DeleteIcon />
            </button>
          </div>
        )
      })}

      {undoLot && (
        <div className="bento-toast">
          <span>「{undoLot.name}」を1食消費しました</span>
          <button type="button" className="bento-undo" onClick={handleUndo}>
            取り消し
          </button>
        </div>
      )}
    </div>
  )
}
