import { useEffect, useRef, useState } from 'react'
import {
  addExtraItems,
  fetchStapleItems,
  addStapleItem,
  deleteStapleItem,
} from '../utils/extraItemsApi.js'

function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const rec = new SR()
  rec.lang = 'ja-JP'
  rec.interimResults = false
  rec.maxAlternatives = 1
  return rec
}

// 買い物リストへ手動で品を追加するボトムシート。
// テキスト入力 / 音声入力 / よく買うもののチップ から追加できる。
export default function AddItemSheet({ onClose, onAdded }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const [staples, setStaples] = useState([])
  const [picked, setPicked] = useState([])
  const [editMode, setEditMode] = useState(false)
  const recognitionRef = useRef(null)

  function loadStaples() {
    fetchStapleItems().then(setStaples).catch(() => setStaples([]))
  }

  useEffect(() => {
    loadStaples()
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        /* noop */
      }
    }
  }, [])

  function togglePick(name) {
    setPicked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  // 入力欄の内容を定番リストに登録する
  async function registerStaple() {
    const v = text.trim()
    if (!v) return
    await addStapleItem(v)
    setText('')
    loadStaples()
  }

  async function removeStaple(item) {
    await deleteStapleItem(item.id)
    setPicked((prev) => prev.filter((n) => n !== item.name))
    loadStaples()
  }

  async function commit(explicitText) {
    const typed = (explicitText ?? text).trim()
    const parts = [...picked]
    if (typed) parts.push(typed)
    if (parts.length === 0 || saving) return

    setSaving(true)
    setError(null)
    try {
      await addExtraItems(parts.join('、'))
      onAdded()
      onClose()
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
      if (said) setText(said)
    }
    rec.onerror = () => {
      setError('音声を認識できませんでした')
      setListening(false)
    }
    rec.onend = () => setListening(false)
    rec.start()
  }

  const totalToAdd = picked.length + (text.trim() ? 1 : 0)

  return (
    <div className="m3-sheet-overlay" onClick={onClose}>
      <div className="m3-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="m3-sheet-handle" />
        <p className="m3-sheet-title">買い物リストに追加</p>

        <div className="m3-add-row">
          <input
            className="m3-text-field"
            type="text"
            value={text}
            placeholder="品名を入力(読点で複数可)"
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
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

        {listening && <p className="m3-listening-hint">聞き取り中… 話しかけてください</p>}

        <div className="m3-sheet-subtitle-row">
          <p className="m3-sheet-subtitle">よく買うもの</p>
          <div className="m3-sheet-subtitle-actions">
            {text.trim() && !editMode && (
              <button type="button" className="m3-text-button" onClick={registerStaple}>
                ＋定番に登録
              </button>
            )}
            {staples.length > 0 && (
              <button type="button" className="m3-text-button" onClick={() => setEditMode((v) => !v)}>
                {editMode ? '完了' : '編集'}
              </button>
            )}
          </div>
        </div>

        {staples.length === 0 ? (
          <p className="m3-supporting-text">
            上の入力欄に品名を入れて「＋定番に登録」を押すと、次回からワンタップで選べます。
          </p>
        ) : (
          <div className="m3-chip-wrap">
            {staples.map((f) => (
              <span key={f.id} className={`m3-staple-chip${picked.includes(f.name) ? ' active' : ''}`}>
                <button
                  type="button"
                  className="m3-staple-chip-label"
                  disabled={editMode}
                  onClick={() => togglePick(f.name)}
                >
                  {f.name}
                </button>
                {editMode && (
                  <button
                    type="button"
                    className="m3-staple-chip-remove"
                    onClick={() => removeStaple(f)}
                    aria-label={`${f.name}を定番から削除`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {error && <p className="login-error">{error}</p>}

        <div className="m3-sheet-actions">
          <button type="button" className="m3-text-button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="m3-filled-button"
            disabled={saving || totalToAdd === 0}
            onClick={() => commit()}
          >
            {saving ? '追加中…' : totalToAdd > 0 ? `${totalToAdd}件を追加` : '追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
