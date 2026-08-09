import { useEffect, useState } from 'react'
import { fetchShoppingList, toggleShoppingItem } from '../utils/shoppingListApi.js'

function Section({ title, children, count }) {
  if (count === 0) return null
  return (
    <div className="shopping-section">
      <p className="area-label">{title}</p>
      {children}
    </div>
  )
}

export default function ShoppingListScreen({ onBack, onRegenerate }) {
  const [list, setList] = useState(undefined) // undefined=読み込み中, null=未生成
  const [busyKey, setBusyKey] = useState(null)

  function load() {
    fetchShoppingList().then(setList)
  }

  useEffect(load, [])

  async function handleToggle(section, item) {
    setBusyKey(item.key)
    // 楽観的に画面を先に更新
    setList((prev) => {
      const items = { ...prev.items }
      items[section] = items[section].map((it) => (it.key === item.key ? { ...it, checked: !it.checked } : it))
      return { ...prev, items }
    })
    try {
      await toggleShoppingItem(section, item.key, !item.checked)
    } finally {
      setBusyKey(null)
    }
  }

  if (list === undefined) {
    return (
      <div className="edit-screen">
        <div className="edit-screen-sticky">
          <div className="edit-screen-head">
            <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">‹ 戻る</button>
            <span className="edit-screen-date">買い物リスト</span>
          </div>
        </div>
        <p className="loading-text">読み込み中…</p>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="edit-screen">
        <div className="edit-screen-sticky">
          <div className="edit-screen-head">
            <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">‹ 戻る</button>
            <span className="edit-screen-date">買い物リスト</span>
          </div>
        </div>
        <div className="range-picker-body">
          <p className="empty-text">まだ買い物リストが作成されていません。</p>
          <button type="button" className="btn btn-primary" onClick={onRegenerate}>作成する</button>
        </div>
      </div>
    )
  }

  const { toBuy = [], rangeItems = [], optionalItems = [], unclearItems = [] } = list.items ?? {}
  const warnings = list.warnings ?? []
  const recipeSummary = list.recipe_summary ?? []

  return (
    <div className="edit-screen">
      <div className="edit-screen-sticky">
        <div className="edit-screen-head">
          <button type="button" className="back-btn" onClick={onBack} aria-label="戻る">‹ 戻る</button>
          <span className="edit-screen-date">買い物リスト</span>
        </div>
      </div>

      <div className="range-picker-body">
        <p className="shopping-meta">
          対象期間: {list.start_date} 〜 {list.end_date}
          <br />
          作成日時: {new Date(list.generated_at).toLocaleString('ja-JP')}
        </p>
        {recipeSummary.length > 0 && (
          <p className="shopping-meta">
            対象レシピ: {recipeSummary.map((r) => `${r.title}×${r.occurrences}`).join('、')}
          </p>
        )}
        <button type="button" className="header-btn" onClick={onRegenerate}>
          条件を変えて作り直す
        </button>

        {warnings.length > 0 && (
          <div className="shopping-warning">
            {warnings.map((w, i) => (
              <p key={i}>⚠️ {w.recipeTitle}: {w.reason}</p>
            ))}
          </div>
        )}

        <Section title="買うもの" count={toBuy.length}>
          {toBuy.map((it) => (
            <label key={it.key} className={`shopping-row${it.checked ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={it.checked}
                disabled={busyKey === it.key}
                onChange={() => handleToggle('toBuy', it)}
              />
              <span className="shopping-name">{it.name}</span>
              <span className="shopping-qty">{it.qty}{it.unit}</span>
            </label>
          ))}
        </Section>

        <Section title="目安(レシピごと)" count={rangeItems.length}>
          {rangeItems.map((it) => (
            <label key={it.key} className={`shopping-row${it.checked ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={it.checked}
                disabled={busyKey === it.key}
                onChange={() => handleToggle('rangeItems', it)}
              />
              <span className="shopping-name">{it.name}</span>
              <span className="shopping-qty">
                {it.qtyMin ?? ''}〜{it.qtyMax ?? ''}{it.unit}
                {it.occurrences > 1 ? ` ×${it.occurrences}` : ''}
              </span>
            </label>
          ))}
        </Section>

        <Section title="あれば使うもの" count={optionalItems.length}>
          {optionalItems.map((it) => (
            <label key={it.key} className={`shopping-row${it.checked ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={it.checked}
                disabled={busyKey === it.key}
                onChange={() => handleToggle('optionalItems', it)}
              />
              <span className="shopping-name">{it.name}</span>
              <span className="shopping-qty">{it.notes?.join(' / ')}</span>
            </label>
          ))}
        </Section>

        <Section title="要確認" count={unclearItems.length}>
          {unclearItems.map((it) => (
            <div key={it.key} className="shopping-row">
              <span className="shopping-name">{it.name}</span>
              <span className="shopping-qty">{it.raw}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}
