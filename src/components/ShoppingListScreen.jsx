import { useEffect, useMemo, useState } from 'react'
import AddItemSheet from './AddItemSheet.jsx'
import { DeleteIcon } from './ActionIcons.jsx'
import { fetchShoppingList, toggleShoppingItem } from '../utils/shoppingListApi.js'
import {
  fetchExtraItems,
  toggleExtraItem,
  deleteExtraItem,
  CATEGORY_ORDER,
} from '../utils/extraItemsApi.js'

// 献立由来の材料1行(タップで諸元の明細を展開)
function MenuRow({ item, onToggle, busy }) {
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
          <span className="m3-row-main">
            <span className="m3-list-title">{item.name}</span>
            <span className="m3-row-chips">
              <span className="m3-chip-cat">{item.category}</span>
              <span className="m3-chip-src menu">献立</span>
              {item.skip && <span className="m3-chip-mini">計上不要</span>}
            </span>
          </span>
          <span className="m3-list-meta">{qtyLabel}</span>
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

// 手動登録1行(右端にゴミ箱)
function ExtraRow({ item, onToggle, onDelete }) {
  return (
    <div className={`m3-list-item-wrap${item.checked ? ' is-checked' : ''}`}>
      <div className="m3-list-item">
        <input
          type="checkbox"
          className="m3-checkbox"
          checked={!!item.checked}
          onChange={() => onToggle(item)}
        />
        <div className="m3-list-body m3-list-body-static">
          <span className="m3-row-main">
            <span className="m3-list-title">{item.name}</span>
            <span className="m3-row-chips">
              <span className="m3-chip-cat">{item.category || 'その他'}</span>
              <span className="m3-chip-src manual">手動</span>
            </span>
          </span>
        </div>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          onClick={() => onDelete(item)}
          aria-label="削除"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  )
}

export default function ShoppingListScreen({ onRegenerate }) {
  const [list, setList] = useState(undefined)
  const [extras, setExtras] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const [hideChecked, setHideChecked] = useState(false)
  const [sortMode, setSortMode] = useState('category') // 'category' | 'recipe'
  const [sheetOpen, setSheetOpen] = useState(false)

  function loadAll() {
    fetchShoppingList().then(setList)
    fetchExtraItems().then(setExtras).catch(() => setExtras([]))
  }

  useEffect(loadAll, [])

  async function handleToggleMenu(item, checked) {
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

  async function handleToggleExtra(item) {
    const next = !item.checked
    setExtras((prev) => prev.map((it) => (it.id === item.id ? { ...it, checked: next } : it)))
    try {
      await toggleExtraItem(item.id, next)
    } catch {
      loadAll()
    }
  }

  async function handleDeleteExtra(item) {
    setExtras((prev) => prev.filter((it) => it.id !== item.id))
    try {
      await deleteExtraItem(item.id)
    } catch {
      loadAll()
    }
  }

  // 献立由来と手動登録を1つのリストに統合する。
  // 見出しは出さずカテゴリ順に並べるだけにして、1画面あたりの表示量を増やしている。
  const rows = useMemo(() => {
    const menuItems = (list?.items?.groups ?? []).flatMap((g) =>
      g.items.map((it) => ({ kind: 'menu', category: g.category, ...it }))
    )
    const extraItems = extras.map((it) => ({
      kind: 'extra',
      category: it.category || 'その他',
      ...it,
    }))

    let all = [...menuItems, ...extraItems]
    if (!showSkipped) all = all.filter((it) => !(it.kind === 'menu' && it.skip))
    if (hideChecked) all = all.filter((it) => !it.checked)

    if (sortMode === 'recipe') {
      // レシピ順: 献立由来はレシピ名、手動登録は末尾にまとめる
      const keyOf = (it) => (it.kind === 'menu' ? it.details?.[0]?.recipeTitle ?? '' : '\uffff手動登録')
      return all.sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'ja') || a.name.localeCompare(b.name, 'ja'))
    }

    const catIndex = (c) => {
      const i = CATEGORY_ORDER.indexOf(c)
      return i === -1 ? 999 : i
    }
    return all.sort(
      (a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, 'ja')
    )
  }, [list, extras, showSkipped, hideChecked, sortMode])

  const remaining = rows.filter((r) => !r.checked).length

  return (
    <div className="shopping-screen">
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
        <div className="m3-toolbar-switches">
          <label className="m3-switch-row">
            <span className="m3-switch-label">未購入のみ</span>
            <button
              type="button"
              role="switch"
              aria-checked={hideChecked}
              className={`m3-switch${hideChecked ? ' on' : ''}`}
              onClick={() => setHideChecked((v) => !v)}
            >
              <span className="m3-switch-thumb" />
            </button>
          </label>
          <label className="m3-switch-row">
            <span className="m3-switch-label">計上不要も</span>
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
      </div>

      <div className="m3-content">
        <div className="m3-list-head-row">
          <p className="m3-supporting-text">
            {list ? `${list.start_date} 〜 ${list.end_date}ぶん・` : ''}
            残り{remaining}品
          </p>
          <button type="button" className="m3-tonal-button m3-tonal-button-sm" onClick={onRegenerate}>
            {list ? '作り直す' : '献立から作成'}
          </button>
        </div>

        {(list?.warnings ?? []).length > 0 && (
          <div className="m3-banner">
            材料明細が未登録のレシピがあります: {list.warnings.join('、')}
          </div>
        )}

        {list === undefined ? (
          <p className="m3-empty">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="m3-empty">
            表示できる品がありません。右下のボタンから追加するか、献立から作成してください。
          </p>
        ) : (
          <div className="m3-card">
            {rows.map((r) =>
              r.kind === 'menu' ? (
                <MenuRow
                  key={`m-${r.ingredientId}`}
                  item={r}
                  onToggle={handleToggleMenu}
                  busy={busyId === r.ingredientId}
                />
              ) : (
                <ExtraRow
                  key={`e-${r.id}`}
                  item={r}
                  onToggle={handleToggleExtra}
                  onDelete={handleDeleteExtra}
                />
              )
            )}
          </div>
        )}
      </div>

      <div className="m3-fab-wrap">
        <button type="button" className="m3-fab" onClick={() => setSheetOpen(true)} aria-label="品を追加">
          ＋
        </button>
      </div>

      {sheetOpen && <AddItemSheet onClose={() => setSheetOpen(false)} onAdded={loadAll} />}
    </div>
  )
}
