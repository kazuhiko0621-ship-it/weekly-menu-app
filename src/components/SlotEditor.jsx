import { useEffect, useRef, useState } from 'react'
import ComboBoxInput from './ComboBoxInput.jsx'
import NotionIcon from './NotionIcon.jsx'
import ManualIcon from './ManualIcon.jsx'
import { searchNotionRecipes } from '../utils/notion.js'
import { searchHistoryMeals } from '../utils/mealsApi.js'

// 朝/昼/夜 1コマ分の編集UI。
// 名称検索(Notion + 過去の手入力履歴を横断)と、
// Notionの「カテゴリー」「評価」による絞り込みを1つの入力にまとめている。
export default function SlotEditor({ slotLabel, meal, notionMeta, onSave, onClear }) {
  const [text, setText] = useState(meal?.name ?? '')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedRatings, setSelectedRatings] = useState([])
  const [notionResults, setNotionResults] = useState([])
  const [historyResults, setHistoryResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [pickedNotion, setPickedNotion] = useState(
    meal?.notion_url ? { id: meal.notion_page_id, url: meal.notion_url } : null
  )
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
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const [notion, history] = await Promise.all([
        searchNotionRecipes({ query: text, categories: selectedCategories, ratings: selectedRatings }),
        // カテゴリー/評価はNotion側のみの情報なので、履歴検索は名称のみで絞り込む
        selectedCategories.length === 0 && selectedRatings.length === 0
          ? searchHistoryMeals(text)
          : Promise.resolve([]),
      ])
      setNotionResults(notion)
      // Notionにも同名で出てくるものは履歴側から除外して重複を防ぐ
      const notionNames = new Set(notion.map((n) => n.name))
      setHistoryResults(history.filter((h) => !notionNames.has(h.name)))
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [text, selectedCategories, selectedRatings])

  function toggleCategory(name) {
    setSelectedCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
  }
  function toggleRating(name) {
    setSelectedRatings((prev) => (prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]))
  }

  function handleTextChange(v) {
    setText(v)
    setPickedNotion(null)
  }

  function handleSelectNotion(item) {
    setText(item.name)
    setPickedNotion({ id: item.id, url: item.url })
    onSave({ name: item.name, notion_page_id: item.id, notion_url: item.url, source: 'notion' })
  }

  function handleSelectHistory(item) {
    setText(item.name)
    const hasNotion = !!item.notion_url
    setPickedNotion(hasNotion ? { id: item.notion_page_id, url: item.notion_url } : null)
    onSave({
      name: item.name,
      notion_page_id: item.notion_page_id ?? null,
      notion_url: item.notion_url ?? null,
      source: hasNotion ? 'notion' : 'history',
    })
  }

  function saveManual() {
    onSave({
      name: text,
      notion_page_id: pickedNotion?.id ?? null,
      notion_url: pickedNotion?.url ?? null,
      source: pickedNotion ? 'notion' : 'manual',
    })
  }

  const suggestions = [
    ...notionResults.map((r) => ({
      id: `n-${r.id}`,
      label: r.name,
      sublabel: r.category || undefined,
      icon: <NotionIcon />,
      name: r.name,
      url: r.url,
      notionId: r.id,
      isNotion: true,
    })),
    ...historyResults.map((h) => ({
      id: `h-${h.name}`,
      label: h.name,
      icon: h.notion_url ? <NotionIcon /> : <ManualIcon />,
      name: h.name,
      notion_url: h.notion_url,
      notion_page_id: h.notion_page_id,
      isNotion: false,
    })),
  ]

  return (
    <div className="slot-editor">
      <div className="slot-editor-head">
        <span className="slot-editor-label">{slotLabel}</span>
      </div>

      {(categoryOptions.length > 0 || ratingOptions.length > 0) && (
        <div className="filter-groups">
          {categoryOptions.length > 0 && (
            <div className="picker-row">
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
            <div className="picker-row">
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
      )}

      <ComboBoxInput
        value={text}
        onChange={handleTextChange}
        onSelectSuggestion={(s) => (s.isNotion ? handleSelectNotion(s) : handleSelectHistory(s))}
        suggestions={suggestions}
        loading={loading}
        placeholder="献立名を入力(Notion + 過去の入力から検索)"
      />

      {pickedNotion?.url && (
        <a className="notion-link" href={pickedNotion.url} target="_blank" rel="noreferrer">
          <NotionIcon /> Notionでレシピを開く
        </a>
      )}

      <div className="slot-editor-actions">
        <button type="button" className="btn btn-primary" onClick={saveManual}>
          保存
        </button>
        {meal && (
          <button type="button" className="btn btn-ghost" onClick={onClear}>
            削除
          </button>
        )}
      </div>
    </div>
  )
}
