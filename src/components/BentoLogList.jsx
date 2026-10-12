import { useEffect, useMemo, useState } from 'react'
import { DeleteIcon } from './ActionIcons.jsx'
import { fetchBentoLog, deleteBentoLogEntry } from '../utils/bentoApi.js'

const DOW = ['日', '月', '火', '水', '木', '金', '土']

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`
}

// 弁当ログ(サブタブ3)。食べた記録を日付ごとにまとめて表示する。
export default function BentoLogList({ refreshKey }) {
  const [rows, setRows] = useState(undefined)

  function load() {
    fetchBentoLog()
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(load, [refreshKey])

  const groups = useMemo(() => {
    if (!rows) return []
    const byDate = new Map()
    for (const r of rows) {
      const list = byDate.get(r.eaten_on) ?? []
      list.push(r)
      byDate.set(r.eaten_on, list)
    }
    return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }))
  }, [rows])

  async function handleDelete(row) {
    if (!window.confirm(`「${row.name}」(${formatDay(row.eaten_on)})の記録を削除しますか？\n在庫は戻りません。`))
      return
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    try {
      await deleteBentoLogEntry(row.id)
    } finally {
      load()
    }
  }

  if (rows === undefined) return <p className="m3-empty">読み込み中…</p>

  if (rows.length === 0) {
    return (
      <p className="m3-empty">
        まだ記録がありません。
        <br />
        在庫一覧で「消費」すると、ここに記録されます。
      </p>
    )
  }

  return (
    <div className="bento-log">
      <p className="m3-supporting-text bento-log-total">全{rows.length}食</p>
      {groups.map((g) => (
        <div key={g.date} className="bento-log-group">
          <p className="bento-log-date">
            {formatDay(g.date)}
            <span className="bento-log-count">{g.items.length}食</span>
          </p>
          <div className="bento-log-card">
            {g.items.map((r) => (
              <div key={r.id} className="bento-log-row">
                {r.notion_url ? (
                  <a
                    className="bento-log-name bento-name-link"
                    href={r.notion_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.name}
                  </a>
                ) : (
                  <span className="bento-log-name">{r.name}</span>
                )}
                <button
                  type="button"
                  className="icon-btn icon-btn-danger icon-btn-sm"
                  onClick={() => handleDelete(r)}
                  aria-label="記録を削除"
                >
                  <DeleteIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
