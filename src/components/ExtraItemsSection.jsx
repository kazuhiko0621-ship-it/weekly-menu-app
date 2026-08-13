import { useEffect, useRef, useState } from 'react'
import { DeleteIcon } from './ActionIcons.jsx'
import {
  fetchExtraItems,
  addExtraItems,
  toggleExtraItem,
  deleteExtraItem,
  deleteCheckedExtraItems,
  groupExtraItems,
} from '../utils/extraItemsApi.js'

// ブラウザの音声認識(Web Speech API)。iOS Safariでも利用できる。
function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const rec = new SR()
  rec.lang = 'ja-JP'
  rec.interimResults = false
  rec.maxAlternatives = 1
  return rec
}

// 買い物リスト画面の「手動で追加」セクション。
// 献立から作るリストとは独立していて、リストを作り直しても消えない。
export default function ExtraItemsSection({ onCountChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  function load() {
    setLoading(true)
    fetchExtraItems()
      .then((data) => {
        setItems(data)
        onCountChange?.(data.length)
      })
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        /* noop */
      }
    }
  }, [])

  async function handleAdd(value) {
    const v = (value ?? text).trim()
    if (!v || saving) return
    setSaving(true)
    setError(null)
    try {
      await addExtraItems(v)
      setText('')
      load()
    } catch (e) {
      console.error(e)
      setError('追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function handleVoice() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = getRecognition()
    if (!rec) {
      setError('このブラウザは音声入力に対応していません')
      return
    }
    recognitionRef.current = rec
    setError(null)
    setListening(true)
    rec.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript ?? ''
      if (said) {
        setText(said)
        handleAdd(said)
      }
    }
    rec.onerror = () => {
      setError('音声を認識できませんでした')
      setListening(false)
    }
    rec.onend = () => setListening(false)
    rec.start()
  }

  async function handleToggle(item) {
    const next = !item.checked
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, checked: next } : it)))
    try {
      await toggleExtraItem(item.id, next)
    } catch {
      load()
    }
  }

  async function handleDelete(item) {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== item.id)
      onCountChange?.(next.length)
      return next
    })
    try {
      await deleteExtraItem(item.id)
    } catch {
      load()
    }
  }

  async function handleDeleteChecked() {
    const count = items.filter((it) => it.checked).length
    if (count === 0) return
    if (!window.confirm(`チェック済みの${count}件を削除しますか？`)) return
    await deleteCheckedExtraItems()
    load()
  }

  const groups = groupExtraItems(items)
  const checkedCount = items.filter((it) => it.checked).length

  return (
    <div className="m3-group">
      <div className="m3-card m3-card-padded">
        <div className="m3-add-row">
          <input
            className="m3-text-field"
            type="text"
            value={text}
            placeholder="品名を入力(読点で複数可)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
          />
          <button
            type="button"
            className={`m3-mic-button${listening ? ' listening' : ''}`}
            onClick={handleVoice}
            aria-label="音声で入力"
          >
            🎤
          </button>
        </div>
        <div className="m3-add-actions">
          <button
            type="button"
            className="m3-filled-button"
            disabled={saving || !text.trim()}
            onClick={() => handleAdd()}
          >
            {saving ? '追加中…' : '追加'}
          </button>
          {checkedCount > 0 && (
            <button type="button" className="m3-text-button" onClick={handleDeleteChecked}>
              チェック済みを削除({checkedCount})
            </button>
          )}
        </div>
        {listening && <p className="m3-listening-hint">聞き取り中… 話しかけてください</p>}
        {error && <p className="login-error">{error}</p>}
      </div>

      {loading ? (
        <p className="m3-empty">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="m3-supporting-text">まだ追加された品はありません。</p>
      ) : (
        groups.map((g) => (
          <div key={g.category} className="m3-group">
            <p className="m3-group-subheader">{g.category}</p>
            <div className="m3-card">
              {g.items.map((it) => (
                <div key={it.id} className={`m3-list-item-wrap${it.checked ? ' is-checked' : ''}`}>
                  <div className="m3-list-item">
                    <input
                      type="checkbox"
                      className="m3-checkbox"
                      checked={it.checked}
                      onChange={() => handleToggle(it)}
                    />
                    <span className="m3-list-title m3-extra-name">{it.name}</span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => handleDelete(it)}
                      aria-label="削除"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
