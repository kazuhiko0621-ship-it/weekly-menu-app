import { useEffect, useMemo, useState } from 'react'
import { fetchBentoRecipes } from '../utils/notion.js'
import { addBentoLot } from '../utils/bentoApi.js'
import { toDateKey } from '../utils/date.js'

// 作りおき登録(サブタブ2)。Notionで「弁当」がONのレシピから選んで食数を登録する。
export default function BentoRegisterForm({ onRegistered, onMessage }) {
  const [recipes, setRecipes] = useState(undefined)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [madeOn, setMadeOn] = useState(() => toDateKey(new Date()))
  const [count, setCount] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchBentoRecipes()
      .then((r) => !cancelled && setRecipes(r))
      .catch(() => {
        if (cancelled) return
        setRecipes([])
        setError('レシピを取得できませんでした。Notionの接続設定を確認してください。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return recipes ?? []
    return (recipes ?? []).filter((r) => r.name.toLowerCase().includes(q))
  }, [recipes, filter])

  async function handleSubmit() {
    if (saving) return
    if (!selected) {
      setError('メニューを選んでください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addBentoLot({
        notion_page_id: selected.id,
        name: selected.name,
        notion_url: selected.url,
        made_on: madeOn,
        count,
      })
      setSelected(null)
      setFilter('')
      setCount(4)
      onMessage?.('登録しました')
      onRegistered?.()
    } catch (e) {
      console.error(e)
      setError('登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bento-form">
      <p className="area-label">作った日</p>
      <input
        type="date"
        className="m3-text-field"
        value={madeOn}
        onChange={(e) => setMadeOn(e.target.value)}
      />

      <p className="area-label">メニュー(Notionで弁当ONのレシピ)</p>
      {recipes === undefined ? (
        <p className="m3-empty">読み込み中…</p>
      ) : recipes.length === 0 ? (
        <p className="m3-supporting-text">
          弁当がONのレシピがありません。Notionのレシピに「弁当」チェックを付けてください。
        </p>
      ) : (
        <>
          <input
            className="m3-text-field"
            type="text"
            value={filter}
            placeholder="メニュー名で絞り込み"
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="bento-menu-list">
            {visible.length === 0 ? (
              <p className="results-hint">一致するメニューがありません</p>
            ) : (
              visible.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={`bento-menu-item${selected?.id === r.id ? ' selected' : ''}`}
                  onClick={() => {
                    setSelected(r)
                    setError(null)
                  }}
                >
                  <span className="bento-menu-name">{r.name}</span>
                  {r.category && <span className="result-sublabel">{r.category}</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}

      <p className="area-label">食数</p>
      <div className="bento-stepper">
        <button
          type="button"
          className="bento-step-btn"
          disabled={count <= 1}
          onClick={() => setCount((c) => Math.max(1, c - 1))}
          aria-label="1食減らす"
        >
          −
        </button>
        <span className="bento-step-value">{count}食</span>
        <button
          type="button"
          className="bento-step-btn"
          disabled={count >= 10}
          onClick={() => setCount((c) => Math.min(10, c + 1))}
          aria-label="1食増やす"
        >
          ＋
        </button>
        <span className="bento-step-hint">最大10食</span>
      </div>

      {error && <div className="m3-banner m3-banner-error">{error}</div>}

      <button
        type="button"
        className="m3-filled-button"
        disabled={saving || !selected}
        onClick={handleSubmit}
      >
        {saving ? '登録中…' : 'この内容で登録'}
      </button>
      <p className="m3-supporting-text">
        登録すると在庫一覧に新しいロットとして追加されます。献立や買い物リストには影響しません。
      </p>
    </div>
  )
}
