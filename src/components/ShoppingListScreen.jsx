import { useEffect, useMemo, useState } from 'react'
import ExtraItemsSection from './ExtraItemsSection.jsx'
import { fetchShoppingList, toggleShoppingItem } from '../utils/shoppingListApi.js'
import { fetchExtraItems } from '../utils/extraItemsApi.js'

// 材料1件の行(タップで諸元となった明細を展開)
function IngredientRow({ item, onToggle, busy }) {
  const [open, setOpen] = useState(false)
  const qtyLabel =
    item.totalQty != null && item.totalQty > 0
      ? `${Math.round(item.totalQty * 100) / 100}${item.unit ?? ''}`
      : item.hasUnknownQty
        ? '適量'
        : ''

  return (
    <div className={`m3-list-item-wrap${item.checked ? ' is-checked' : ''}`}>
      <div className="m3-list-item">
        <input
          type="checkbox"
          className="m3-checkbox"
          checked={!!item.checked}
          disabled={busy}
          onChange={() => onToggle(item, !item.checked)}
        />
        <button type="button" className="m3-list-body" onClick={() => setOpen((v) => !v)}>
          <span className="m3-list-title">
            {item.name}
            {item.skip && <span className="m3-chip-mini">計上不要</span>}
          </span>
          <span className="m3-list-meta">
            {qtyLabel}
            {item.hasUnknownQty && item.totalQty > 0 ? ' +適量' : ''}
          </span>
          <span className={`m3-expand-icon${open ? ' open' : ''}`}>▾</span>
        </button>
      </div>

      {open && (
        <div className="m3-detail-panel">
          {item.details.map((d, i) => (
            <div key={i} className="m3-detail-row">
              {d.recipeUrl ? (
                <a className="m3-detail-recipe" href={d.recipeUrl} target="_blank" rel="noreferrer">
                  {d.recipeTitle}
                  {d.occurrences > 1 ? ` ×${d.occurrences}` : ''}
                </a>
              ) : (
                <span className="m3-detail-recipe">{d.recipeTitle}</span>
              )}
              <div className="m3-detail-sub">
                <span>{d.qty != null ? `${d.qty}${item.unit ?? ''}` : '適量'}</span>
                {d.rawText && <span className="m3-detail-raw">{d.rawText}</span>}
              </div>
              {d.note && <p className="m3-detail-note">{d.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ShoppingListScreen({ onBack, onRegenerate }) {
  const [list, setList] = useState(undefined)
  const [busyId, setBusyId] = useState(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const [sortMode, setSortMode] = useState('category') // 'category' | 'recipe'
  const [tab, setTab] = useState('menu') // 'menu' | 'extra'
  const [extraCount, setExtraCount] = useState(0)

  useEffect(() => {
    fetchShoppingList().then(setList)
    // タブのバッジ用に、手動登録の件数も最初に取得しておく
    fetchExtraItems()
      .then((data) => setExtraCount(data.length))
      .catch(() => setExtraCount(0))
  }, [])

  async function handleToggle(item, checked) {
    setBusyId(item.ingredientId)
    setList((prev) => ({
      ...prev,
      items: {
        groups: prev.items.groups.map((g) => ({
          ...g,
          items: g.items.map((it) => (it.ingredientId === item.ingredientId ? { ...it, checked } : it)),
        })),
      },
    }))
    try {
      await toggleShoppingItem(item.ingredientId, checked)
    } finally {
      setBusyId(null)
    }
  }

  // 表示用のグループを組み立てる(カテゴリ順 or レシピ順)
  const displayGroups = useMemo(() => {
    if (!list?.items?.groups) return []
    const allItems = list.items.groups.flatMap((g) => g.items.map((it) => ({ ...it, category: g.category })))
    const visible = allItems.filter((it) => showSkipped || !it.skip)

    if (sortMode === 'category') {
      const out = []
      for (const g of list.items.groups) {
        const items = g.items.filter((it) => showSkipped || !it.skip)
        if (items.length > 0) out.push({ label: g.category, items })
      }
      return out
    }

    // レシピ順: 材料が複数レシピに登場する場合は、それぞれのレシピ配下に表示する
    const byRecipe = new Map()
    for (const it of visible) {
      for (const d of it.details) {
        const key = d.recipeTitle
        const entry = byRecipe.get(key) ?? { label: key, url: d.recipeUrl, items: [] }
        if (!entry.items.some((x) => x.ingredientId === it.ingredientId)) entry.items.push(it)
        byRecipe.set(key, entry)
      }
    }
    return Array.from(byRecipe.values())
  }, [list, showSkipped, sortMode])

  // タブのバッジ用: 献立から集計された材料の件数(重複を除いた実数)
  const menuCount = useMemo(() => {
    if (!list?.items?.groups) return 0
    const ids = new Set()
    for (const g of list.items.groups) {
      for (const it of g.items) {
        if (!showSkipped && it.skip) continue
        ids.add(it.ingredientId)
      }
    }
    return ids.size
  }, [list, showSkipped])

  const extraTabLabel = (
    <>
      手動登録
      <span className={`m3-tab-badge${extraCount === 0 ? ' zero' : ''}`}>{extraCount}</span>
    </>
  )

  function renderShell(children, { withTabs = true } = {}) {
    return (
      <div className="m3-screen">
        <div className="m3-top-app-bar">
          <button type="button" className="m3-icon-button" onClick={onBack} aria-label="戻る">←</button>
          <span className="m3-top-app-bar-title">買い物リスト</span>
        </div>

        {withTabs && (
          <div className="m3-tabs">
            <button
              type="button"
              className={`m3-tab${tab === 'menu' ? ' selected' : ''}`}
              onClick={() => setTab('menu')}
            >
              献立から
              <span className={`m3-tab-badge${menuCount === 0 ? ' zero' : ''}`}>{menuCount}</span>
            </button>
            <button
              type="button"
              className={`m3-tab${tab === 'extra' ? ' selected' : ''}`}
              onClick={() => setTab('extra')}
            >
              {extraTabLabel}
            </button>
          </div>
        )}

        {children}
      </div>
    )
  }

  if (list === undefined) {
    return renderShell(<p className="m3-empty">読み込み中…</p>, { withTabs: false })
  }

  // 献立リストが未作成でも「手動登録」タブは使えるようにする
  if (!list) {
    return renderShell(
      <div className="m3-content">
        {tab === 'menu' ? (
          <>
            <p className="m3-supporting-text">献立からの買い物リストはまだ作成されていません。</p>
            <button type="button" className="m3-filled-button" onClick={onRegenerate}>
              献立から作成する
            </button>
          </>
        ) : (
          <ExtraItemsSection onCountChange={setExtraCount} />
        )}
      </div>
    )
  }

  const warnings = list.warnings ?? []
  const totalVisible = displayGroups.reduce((n, g) => n + g.items.length, 0)

  return renderShell(
    <>
      {tab === 'menu' && (
        <>
          <div className="m3-toolbar">
            <div className="m3-segmented">
              <button
                type="button"
                className={`m3-segment${sortMode === 'category' ? ' selected' : ''}`}
                onClick={() => setSortMode('category')}
              >
                カテゴリ順
              </button>
              <button
                type="button"
                className={`m3-segment${sortMode === 'recipe' ? ' selected' : ''}`}
                onClick={() => setSortMode('recipe')}
              >
                レシピ順
              </button>
            </div>
            <label className="m3-switch-row">
              <span className="m3-switch-label">計上不要も表示</span>
              <button
                type="button"
                role="switch"
                aria-checked={showSkipped}
                className={`m3-switch${showSkipped ? ' on' : ''}`}
                onClick={() => setShowSkipped((v) => !v)}
              >
                <span className="m3-switch-thumb" />
              </button>
            </label>
          </div>

          <div className="m3-content">
            <div className="m3-list-head-row">
              <p className="m3-supporting-text">
                {list.start_date} 〜 {list.end_date}ぶん・{totalVisible}品
              </p>
              <button type="button" className="m3-tonal-button m3-tonal-button-sm" onClick={onRegenerate}>
                作り直す
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="m3-banner">
                材料明細が未登録のレシピがあります: {warnings.join('、')}
              </div>
            )}

            {displayGroups.length === 0 && <p className="m3-empty">表示できる材料がありません。</p>}

            {displayGroups.map((g) => (
              <div key={g.label} className="m3-group">
                <p className="m3-group-header">{g.label}</p>
                <div className="m3-card">
                  {g.items.map((it) => (
                    <IngredientRow
                      key={`${g.label}-${it.ingredientId}`}
                      item={it}
                      onToggle={handleToggle}
                      busy={busyId === it.ingredientId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'extra' && (
        <div className="m3-content">
          <ExtraItemsSection onCountChange={setExtraCount} />
        </div>
      )}
    </>
  )
}
