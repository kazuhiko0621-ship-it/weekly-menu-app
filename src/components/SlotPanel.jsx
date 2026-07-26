import { useEffect, useRef, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { EditIcon, DeleteIcon } from './ActionIcons.jsx'
import MessageModal from './MessageModal.jsx'
import { searchNotionRecipes } from '../utils/notion.js'
import { searchHistoryMeals, insertMeal, updateMeal, deleteMeal } from '../utils/mealsApi.js'

// 1つの食事コマ(朝/昼/夜のいずれか)の編集パネル。
// 上から「登録済み一覧」「検索条件」「部分一致結果」の3エリア構成。
export default function SlotPanel({ slotLabel, slotKey, dateKey, meals, notionMeta, onChanged }) {
  const [selectedMealId, setSelectedMealId] = useState(null) // 更新対象(登録済み側)
  const [text, setText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedRatings, setSelectedRatings] = useState([])
  const [notionResults, setNotionResults] = useState([])
  const [historyResults, setHistoryResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [message, setMessage] = useState(null)
  const debounceRef = useRef(null)

  const categoryOptions = notionMeta?.category?.options ?? []
  const ratingOptions = notionMeta?.rating?.options ?? []

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const hasAnyCondition =
      text.trim().length > 0 || selectedCategories.length > 0 || selectedRatings.length > 0
    if (!hasAnyCondition) {
      setNotionResults([])
      setHistoryResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const [notion, history] = await Promise.all([
        searchNotionRecipes({ query: text, categories: selectedCategories, ratings: selectedRatings }),
        selectedCategories.length === 0 && selectedRatings.length === 0
          ? searchHistoryMeals(text)
          : Promise.resolve([]),
      ])
      const notionNames = new Set(notion.map((n) => n.name))
      setNotionResults(notion)
      setHistoryResults(history.filter((h) => !notionNames.has(h.name)))
      setLoading(false)
      setSearched(true)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [text, selectedCategories, selectedRatings])

  function toggleCategory(name) {
    setSelectedCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
  }
  function toggleRating(name) {
    setSelectedRatings((prev) => (prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]))
  }

  function startUpdate(meal) {
    setSelectedMealId(meal.id)
    setText(meal.name)
    setSelectedCategories([])
    setSelectedRatings([])
    setSelectedCandidate({
      key: 'current',
      name: meal.name,
      notion_page_id: meal.notion_page_id,
      notion_url: meal.notion_url,
      source: meal.source,
    })
  }

  function cancelUpdate() {
    setSelectedMealId(null)
    resetSearch()
  }

  function resetSearch() {
    setText('')
    setSelectedCategories([])
    setSelectedRatings([])
    setNotionResults([])
    setHistoryResults([])
    setSearched(false)
    setSelectedCandidate(null)
  }

  async function handleDelete(meal) {
    if (!window.confirm(`「${meal.name}」を削除しますか？`)) return
    await deleteMeal(meal.id)
    if (selectedMealId === meal.id) {
      setSelectedMealId(null)
      resetSearch()
    }
    setMessage('削除しました')
    onChanged()
  }

  async function handleCommit() {
    if (!selectedCandidate) return
    const payload = {
      name: selectedCandidate.name,
      notion_page_id: selectedCandidate.notion_page_id ?? null,
      notion_url: selectedCandidate.notion_url ?? null,
      source: selectedCandidate.source ?? (selectedCandidate.notion_url ? 'notion' : 'manual'),
    }
    if (selectedMealId) {
      await updateMeal(selectedMealId, payload)
      setMessage('更新しました')
    } else {
      await insertMeal({ date: dateKey, slot: slotKey, ...payload })
      setMessage('登録しました')
    }
    setSelectedMealId(null)
    resetSearch()
    onChanged()
  }

  const results = [
    ...notionResults.map((r) => ({
      key: `n-${r.id}`,
      name: r.name,
      sublabel: r.category || undefined,
      icon: <NotionIcon />,
      notion_page_id: r.id,
      notion_url: r.url,
      source: 'notion',
    })),
    ...historyResults.map((h) => ({
      key: `h-${h.name}`,
      name: h.name,
      icon: h.notion_url ? <NotionIcon /> : <ManualIcon />,
      notion_page_id: h.notion_page_id ?? null,
      notion_url: h.notion_url ?? null,
      source: h.notion_url ? 'notion' : 'history',
    })),
  ]

  const showFallback = searched && !loading && results.length === 0 && text.trim().length > 0

  return (
    <div className="slot-panel">
      {meals.length > 0 && (
        <div className="registered-area">
          <p className="area-label">登録済み({slotLabel})</p>
          {meals.map((m) => (
            <div key={m.id} className={`registered-row${selectedMealId === m.id ? ' selected' : ''}`}>
              <span className="meal-icon">{m.notion_url ? <NotionIcon /> : <ManualIcon />}</span>
              <span className="registered-name">{m.name}</span>
              <button type="button" className="icon-btn" onClick={() => startUpdate(m)} aria-label="更新する">
                <EditIcon />
              </button>
              <button type="button" className="icon-btn icon-btn-danger" onClick={() => handleDelete(m)} aria-label="削除する">
                <DeleteIcon />
              </button>
            </div>
          ))}
          {selectedMealId && (
            <button type="button" className="cancel-update-btn" onClick={cancelUpdate}>
              更新をやめて新規登録に戻す
            </button>
          )}
        </div>
      )}

      <div className="search-area">
        <p className="area-label">{selectedMealId ? '更新後の内容を検索' : '検索条件'}</p>
        <input
          className="combobox-input"
          type="text"
          value={text}
          placeholder="献立名で検索(Notion + 過去の入力)"
          onChange={(e) => {
            setText(e.target.value)
            setSelectedCandidate(null)
          }}
        />
        {categoryOptions.length > 0 && (
          <div className="chip-row-scroll">
            {categoryOptions.map((o) => (
              <button
                type="button"
                key={o.name}
                className={selectedCategories.includes(o.name) ? 'chip active' : 'chip'}
                onClick={() => toggleCategory(o.name)}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
        {ratingOptions.length > 0 && (
          <div className="chip-row-scroll">
            {ratingOptions.map((o) => (
              <button
                type="button"
                key={o.name}
                className={selectedRatings.includes(o.name) ? 'chip active' : 'chip'}
                onClick={() => toggleRating(o.name)}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="results-area">
        <p className="area-label">検索結果</p>
        <div className="results-list">
          {loading && <p className="results-hint">検索中…</p>}
          {!loading && !searched && <p className="results-hint">献立名を入力するか、絞り込み条件を選んでください</p>}
          {!loading &&
            results.map((r) => (
              <button
                type="button"
                key={r.key}
                className={`result-row${selectedCandidate?.key === r.key ? ' selected' : ''}`}
                onClick={() => setSelectedCandidate(r)}
              >
                <span className="meal-icon">{r.icon}</span>
                <span className="result-name">{r.name}</span>
                {r.sublabel && <span className="result-sublabel">{r.sublabel}</span>}
              </button>
            ))}
          {showFallback && (
            <button
              type="button"
              className={`result-row result-row-fallback${
                selectedCandidate?.key === 'manual-current' ? ' selected' : ''
              }`}
              onClick={() =>
                setSelectedCandidate({
                  key: 'manual-current',
                  name: text.trim(),
                  notion_page_id: null,
                  notion_url: null,
                  source: 'manual',
                })
              }
            >
              <span className="meal-icon">
                <ManualIcon />
              </span>
              <span className="result-name">「{text.trim()}」をそのまま登録する</span>
            </button>
          )}
        </div>
      </div>

      <div className="commit-btn-wrap">
        <button type="button" className="commit-btn" disabled={!selectedCandidate} onClick={handleCommit}>
          {selectedMealId ? '更新' : '登録'}
        </button>
      </div>

      <MessageModal message={message} onClose={() => setMessage(null)} />
    </div>
  )
}
