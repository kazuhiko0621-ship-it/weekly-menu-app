import { useEffect, useRef, useState } from 'react'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { searchNotionRecipes } from '../utils/notion.js'
import { searchHistoryMeals, EACH_SOURCE } from '../utils/mealsApi.js'
import { searchRestaurants, formatDistance } from '../utils/places.js'

function modeFromSource(source) {
  if (source === 'each') return 'each'
  if (source === 'dining') return 'dining'
  return 'recipe'
}

// 1つの登録枠(献立の朝/昼/夜、または食べたいものリスト)の検索・登録パネル。
// 「レシピ / 外食 / (各自)」をタブで切り替え、モードごとに検索条件・検索結果を出し分ける。
// 実際の保存処理は行わず、確定した内容を onCommit に渡すだけ(呼び出し側が
// 献立テーブル/食べたいものリストのどちらに書き込むかを決める)。
export default function SlotPanel({
  meals = [],
  selectedMeal,
  notionMeta,
  showEachTab = true,
  onMessage,
  onCommit,
  onCommitted,
}) {
  const MODES = [
    { key: 'recipe', label: 'レシピ' },
    { key: 'dining', label: '外食' },
    ...(showEachTab ? [{ key: 'each', label: '各自' }] : []),
  ]

  const [mode, setMode] = useState('recipe')
  const [text, setText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedRatings, setSelectedRatings] = useState([])
  const [notionResults, setNotionResults] = useState([])
  const [historyResults, setHistoryResults] = useState([])
  const [diningResults, setDiningResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)
  const diningCacheRef = useRef(new Map())
  const diningRequestIdRef = useRef(0)

  const categoryOptions = notionMeta?.category?.options ?? []
  const ratingOptions = notionMeta?.rating?.options ?? []

  // 更新対象(親から渡された selectedMeal)が変わったら検索欄を初期化する
  useEffect(() => {
    if (selectedMeal) {
      setMode(modeFromSource(selectedMeal.source))
      setText(selectedMeal.source === EACH_SOURCE ? '' : selectedMeal.name)
      setSelectedCandidate({
        key: 'current',
        name: selectedMeal.name,
        notion_page_id: selectedMeal.notion_page_id,
        notion_url: selectedMeal.notion_url,
        place_id: selectedMeal.place_id,
        source: selectedMeal.source,
      })
    } else {
      setMode('recipe')
      setText('')
      setSelectedCandidate(null)
    }
    setSelectedCategories([])
    setSelectedRatings([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeal?.id])

  // レシピ検索(Notion + 履歴)
  useEffect(() => {
    if (mode !== 'recipe') return
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
  }, [mode, text, selectedCategories, selectedRatings])

  // 外食検索(Googleマップの店舗名)
  // Google APIの呼び出し回数を減らすため、
  // ・最後の入力から1秒待ってから検索する(デバウンス)
  // ・2文字未満では検索しない
  // ・同じ文字列を再入力した場合はキャッシュを使い回す
  // ・入力中に古いリクエストの結果は無視する
  useEffect(() => {
    if (mode !== 'dining') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = text.trim()
    if (q.length < 2) {
      setDiningResults([])
      setSearched(false)
      return
    }
    const cacheKey = q.toLowerCase()
    const cached = diningCacheRef.current.get(cacheKey)
    if (cached) {
      setDiningResults(cached)
      setSearched(true)
      return
    }
    setLoading(true)
    const requestId = ++diningRequestIdRef.current
    debounceRef.current = setTimeout(async () => {
      const results = await searchRestaurants(q)
      if (requestId !== diningRequestIdRef.current) return // 古いリクエストの結果は無視
      diningCacheRef.current.set(cacheKey, results)
      setDiningResults(results)
      setLoading(false)
      setSearched(true)
    }, 1000)
    return () => clearTimeout(debounceRef.current)
  }, [mode, text])

  function changeMode(nextMode) {
    setMode(nextMode)
    setText('')
    setSelectedCandidate(null)
    setNotionResults([])
    setHistoryResults([])
    setDiningResults([])
    setSearched(false)
  }

  function toggleCategory(name) {
    setSelectedCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
  }
  function toggleRating(name) {
    setSelectedRatings((prev) => (prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]))
  }

  async function handleCommit() {
    if (saving) return
    let payload
    if (mode === 'each') {
      payload = { name: '各自', notion_page_id: null, notion_url: null, place_id: null, source: EACH_SOURCE }
    } else {
      if (!selectedCandidate) return
      payload = {
        name: selectedCandidate.name,
        notion_page_id: selectedCandidate.notion_page_id ?? null,
        notion_url: selectedCandidate.notion_url ?? null,
        place_id: selectedCandidate.place_id ?? null,
        source: selectedCandidate.source,
      }
    }

    setSaving(true)
    try {
      await onCommit(payload)
      onMessage(selectedMeal ? '更新しました' : '登録しました')
      onCommitted()
    } finally {
      setSaving(false)
    }
  }

  // 「各自」が既に登録されている場合、新規登録はできない(更新対象として選んでいる場合を除く)
  const hasEachEntry = meals.some((m) => m.source === EACH_SOURCE && m.id !== selectedMeal?.id)
  const blockedByEach = hasEachEntry && !selectedMeal

  const recipeResults = [
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

  const diningRows = diningResults.map((r) => {
    const distance = formatDistance(r.distanceMeters)
    const sublabel = [distance, r.address].filter(Boolean).join(' ・ ')
    return {
      key: `d-${r.placeId}`,
      name: r.name,
      sublabel: sublabel || undefined,
      icon: '📍',
      place_id: r.placeId,
      source: 'dining',
    }
  })

  const results = mode === 'dining' ? diningRows : recipeResults
  const showFallback = searched && !loading && results.length === 0 && text.trim().length > 0
  const fallbackSource = mode === 'dining' ? 'dining' : 'manual'

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
      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            type="button"
            key={m.key}
            className={mode === m.key ? 'mode-tab active' : 'mode-tab'}
            onClick={() => changeMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'each' ? (
        <p className="results-hint">「各自」として登録します(検索は不要です)</p>
      ) : (
        <>
          <div className="search-area">
            <input
              className="combobox-input"
              type="text"
              value={text}
              placeholder={mode === 'dining' ? '店舗名で検索(Googleマップ)' : '献立名で検索(Notion + 過去の入力)'}
              onChange={(e) => {
                setText(e.target.value)
                setSelectedCandidate(null)
              }}
            />
            {mode === 'recipe' && categoryOptions.length > 0 && (
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
            {mode === 'recipe' && ratingOptions.length > 0 && (
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
              {!loading && !searched && (
                <p className="results-hint">
                  {mode === 'dining' ? '店舗名を入力してください' : '献立名を入力するか、絞り込み条件を選んでください'}
                </p>
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
                      place_id: null,
                      source: fallbackSource,
                    })
                  }
                >
                  <span className="meal-icon">
                    {mode === 'dining' ? '📍' : <ManualIcon />}
                  </span>
                  <span className="result-name">「{text.trim()}」をそのまま登録する</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div className="commit-btn-wrap">
        <button
          type="button"
          className="commit-btn"
          disabled={saving || (mode !== 'each' && !selectedCandidate)}
          onClick={handleCommit}
        >
          {saving ? '処理中…' : selectedMeal ? '更新' : '登録'}
        </button>
      </div>
    </div>
  )
}
