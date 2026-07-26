import { useEffect, useRef, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import ToggleSwitch from './ToggleSwitch.jsx'
import { searchNotionRecipes } from '../utils/notion.js'
import { searchHistoryMeals, insertMeal, updateMeal, EACH_SOURCE } from '../utils/mealsApi.js'

// 1つの食事コマ(朝/昼/夜のいずれか)の検索・登録パネル。
// 「検索条件」「検索結果」の2エリア構成(登録済み一覧は親コンポーネント側で表示)。
export default function SlotPanel({ slotKey, dateKey, meals, selectedMeal, notionMeta, onMessage, onCommitted }) {
  const [text, setText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedRatings, setSelectedRatings] = useState([])
  const [notionResults, setNotionResults] = useState([])
  const [historyResults, setHistoryResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [eachMode, setEachMode] = useState(false)
  const debounceRef = useRef(null)

  const categoryOptions = notionMeta?.category?.options ?? []
  const ratingOptions = notionMeta?.rating?.options ?? []

  // 更新対象(親から渡された selectedMeal)が変わったら検索欄を初期化する
  useEffect(() => {
    if (selectedMeal) {
      setText(selectedMeal.name)
      setEachMode(selectedMeal.source === EACH_SOURCE)
      setSelectedCandidate({
        key: 'current',
        name: selectedMeal.name,
        notion_page_id: selectedMeal.notion_page_id,
        notion_url: selectedMeal.notion_url,
        source: selectedMeal.source,
      })
    } else {
      setText('')
      setEachMode(false)
      setSelectedCandidate(null)
    }
    setSelectedCategories([])
    setSelectedRatings([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeal?.id])

  useEffect(() => {
    if (eachMode) return
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
  }, [text, selectedCategories, selectedRatings, eachMode])

  function toggleCategory(name) {
    setSelectedCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
  }
  function toggleRating(name) {
    setSelectedRatings((prev) => (prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]))
  }

  async function handleCommit() {
    if (eachMode) {
      const payload = { name: '各自', notion_page_id: null, notion_url: null, source: EACH_SOURCE }
      if (selectedMeal) {
        await updateMeal(selectedMeal.id, payload)
        onMessage('更新しました')
      } else {
        await insertMeal({ date: dateKey, slot: slotKey, ...payload })
        onMessage('登録しました')
      }
      onCommitted()
      return
    }

    if (!selectedCandidate) return
    const payload = {
      name: selectedCandidate.name,
      notion_page_id: selectedCandidate.notion_page_id ?? null,
      notion_url: selectedCandidate.notion_url ?? null,
      source: selectedCandidate.source ?? (selectedCandidate.notion_url ? 'notion' : 'manual'),
    }
    if (selectedMeal) {
      await updateMeal(selectedMeal.id, payload)
      onMessage('更新しました')
    } else {
      await insertMeal({ date: dateKey, slot: slotKey, ...payload })
      onMessage('登録しました')
    }
    onCommitted()
  }

  // 「各自」が既に登録されている場合、新規登録はできない(更新対象として選んでいる場合を除く)
  const hasEachEntry = meals.some((m) => m.source === EACH_SOURCE && m.id !== selectedMeal?.id)
  const blockedByEach = hasEachEntry && !selectedMeal

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

  if (blockedByEach) {
    return (
      <div className="slot-panel">
        <p className="results-hint">
          「各自」が登録されているため、追加登録はできません。登録済み一覧から削除するか、更新アイコンから内容を変更してください。
        </p>
      </div>
    )
  }

  return (
    <div className="slot-panel">
      <div className="search-area">
        <input
          className="combobox-input"
          type="text"
          value={text}
          disabled={eachMode}
          placeholder="献立名で検索(Notion + 過去の入力)"
          onChange={(e) => {
            setText(e.target.value)
            setSelectedCandidate(null)
          }}
        />
        {!eachMode && categoryOptions.length > 0 && (
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
        {!eachMode && ratingOptions.length > 0 && (
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
        <div className="results-area-head">
          <p className="area-label">検索結果</p>
          <ToggleSwitch checked={eachMode} onChange={setEachMode} label="各自" />
        </div>
        {eachMode ? (
          <p className="results-hint">「各自」として登録します(レシピの検索は不要です)</p>
        ) : (
          <div className="results-list">
            {loading && <p className="results-hint">検索中…</p>}
            {!loading && !searched && (
              <p className="results-hint">献立名を入力するか、絞り込み条件を選んでください</p>
            )}
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
        )}
      </div>

      <div className="commit-btn-wrap">
        <button
          type="button"
          className="commit-btn"
          disabled={!eachMode && !selectedCandidate}
          onClick={handleCommit}
        >
          {selectedMeal ? '更新' : '登録'}
        </button>
      </div>
    </div>
  )
}
