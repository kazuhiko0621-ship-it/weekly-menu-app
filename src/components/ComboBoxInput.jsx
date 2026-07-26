import { useState } from 'react'

// 汎用コンボボックス: テキスト入力 + 候補ドロップダウン
export default function ComboBoxInput({
  value,
  onChange,
  onSelectSuggestion,
  suggestions,
  placeholder,
  loading,
  autoFocus,
}) {
  const [focused, setFocused] = useState(false)
  const showList = focused && (suggestions.length > 0 || loading)

  return (
    <div className="combobox">
      <input
        className="combobox-input"
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {showList && (
        <ul className="combobox-list">
          {loading && <li className="combobox-empty">検索中…</li>}
          {!loading &&
            suggestions.map((s) => (
              <li
                key={s.id}
                className="combobox-item"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelectSuggestion(s)
                }}
              >
                {s.icon && <span className="combobox-icon">{s.icon}</span>}
                <span className="combobox-label">{s.label}</span>
                {s.sublabel && <span className="combobox-sublabel">{s.sublabel}</span>}
              </li>
            ))}
          {!loading && suggestions.length === 0 && (
            <li className="combobox-empty">一致するレシピがありません(そのまま自由入力できます)</li>
          )}
        </ul>
      )}
    </div>
  )
}
