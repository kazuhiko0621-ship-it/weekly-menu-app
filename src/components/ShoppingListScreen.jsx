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

// ジャンルは文字チップではなく行頭の色帯で表す(横幅を消費せず売り場を判別できる)
const CATEGORY_COLORS = {
  '野菜': '#34a853', 'きのこ': '#7cb342', '海藻': '#00897b', '果物': '#f4511e',
  '肉': '#d93025', '鶏肉': '#e8710a', '豚肉': '#c2185b', '牛肉': '#b71c1c',
  '加工肉': '#ad1457', '魚': '#1a73e8',
  '大豆食品': '#795548', '乳製品': '#039be5', '炭水化物': '#f9ab00',
  '調味料': '#8e24aa', 'スパイス': '#5e35b1', 'その他': '#9aa0a6',
}
const catColor = (c) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS['その他']

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
      <div className="m3-list-item compact">
        <span className="m3-cat-bar" style={{ background: catColor(item.category) }} title={item.category} />
        <input
          type="checkbox"
          className="m3-checkbox"
          checked={!!item.checked}
          disabled={busy}
          onChange={() => onToggle(item, !item.checked)}
        />
        <button type="button" className="m3-list-body compact" onClick={() => setOpen((v) => !v)}>
          <span className="m3-src-icon" title="献立から">📅</span>
          <span className="m3-list-title">{item.name}</span>
          {item.skip && <span className="m3-chip-mini">不要</span>}
          <span className="m3-list-meta">{qtyLabel}</span>
          <span className={`m3-expand-icon${open ? ' open' : ''}`}>▾</span>
        </button>
      </div>

      {open && (
        <div className="m3-detail-panel">
          <p className="m3-detail-cat">{item.category}</p>
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
      <div className="m3-list-item compact">
        <span
          className="m3-cat-bar"
          style={{ background: catColor(item.category || 'その他') }}
          title={item.category || 'その他'}
        />
        <input
          type="checkbox"
          className="m3-checkbox"
          checked={!!item.checked}
          onChange={() => onToggle(item)}
        />
        <div className="m3-list-body compact m3-list-body-static">
          <span className="m3-src-icon" title="手動で追加">✋</span>
          <span className="m3-list-title">{item.name}</span>
        </div>
        <button
          type="button"
          className="icon-btn icon-btn-danger icon-btn-sm"
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
  // カテゴリ順は見出しなしのフラット表示(表示量優先)、
  // レシピ順はどのレシピの材料か分かるよう見出しでグルーピングする。
  const sections = useMemo(() => {
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
      // 1つの材料が複数レシピで使われる場合、それぞれの見出しの下に出す
      const byRecipe = new Map()
      for (const it of all) {
        if (it.kind === 'extra') {
          const key = '手動で追加'
          const entry = byRecipe.get(key) ?? { label: key, url: null, items: [] }
          entry.items.push(it)
          byRecipe.set(key, entry)
          continue
        }
        for (const d of it.details ?? []) {
          const key = d.recipeTitle
          const entry = byRecipe.get(key) ?? { label: key, url: d.recipeUrl, items: [] }
          if (!entry.items.some((x) => x.ingredientId === it.ingredientId)) entry.items.push(it)
          byRecipe.set(key, entry)
        }
      }
      // 「手動で追加」は常に最後に回す
      return Array.from(byRecipe.values()).sort((a, b) => {
        if (a.label === '手動で追加') return 1
        if (b.label === '手動で追加') return -1
        return a.label.localeCompare(b.label, 'ja')
      })
    }

    const catIndex = (c) => {
      const i = CATEGORY_ORDER.indexOf(c)
      return i === -1 ? 999 : i
    }
    all.sort(
      (a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, 'ja')
    )
    return [{ label: null, url: null, items: all }]
  }, [list, extras, showSkipped, hideChecked, sortMode])

  // 件数はレシピ順で重複計上しないよう、ユニークキーで数える
  const remaining = useMemo(() => {
    const seen = new Set()
    for (const sec of sections) {
      for (const r of sec.items) {
        if (r.checked) continue
        seen.add(r.kind === 'menu' ? `m-${r.ingredientId}` : `e-${r.id}`)
      }
    }
    return seen.size
  }, [sections])

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
            <span className="m3-switch-label">未購入</span>
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
            <span className="m3-switch-label">常備品</span>
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
        ) : sections.every((sec) => sec.items.length === 0) ? (
          <p className="m3-empty">
            表示できる品がありません。右下のボタンから追加するか、献立から作成してください。
          </p>
        ) : (
          sections.map((sec) => (
            <div key={sec.label ?? 'all'} className="m3-group">
              {sec.label &&
                (sec.url ? (
                  <a className="m3-section-recipe" href={sec.url} target="_blank" rel="noreferrer">
                    {sec.label}
                  </a>
                ) : (
                  <p className="m3-group-header">{sec.label}</p>
                ))}
              <div className="m3-card">
                {sec.items.map((r) =>
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
            </div>
          ))
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
