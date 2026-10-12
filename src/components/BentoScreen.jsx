import { useCallback, useState } from 'react'
import BentoStockList from './BentoStockList.jsx'
import BentoRegisterForm from './BentoRegisterForm.jsx'
import MessageModal from './MessageModal.jsx'

// 「弁当」タブ。在庫一覧と作りおき登録をサブタブで切り替える。
// 献立機能とは独立していて、人気献立にも買い物リストにも影響しない。
export default function BentoScreen({ onSummaryChange }) {
  const [sub, setSub] = useState('stock') // 'stock' | 'register'
  const [refreshKey, setRefreshKey] = useState(0)
  const [message, setMessage] = useState(null)

  const handleSummary = useCallback(
    (s) => onSummaryChange?.(s),
    [onSummaryChange]
  )

  return (
    <div className="bento-screen">
      <div className="m3-tabs">
        <button
          type="button"
          className={`m3-tab${sub === 'stock' ? ' selected' : ''}`}
          onClick={() => setSub('stock')}
        >
          在庫一覧
        </button>
        <button
          type="button"
          className={`m3-tab${sub === 'register' ? ' selected' : ''}`}
          onClick={() => setSub('register')}
        >
          作りおき登録
        </button>
      </div>

      {sub === 'stock' && (
        <BentoStockList refreshKey={refreshKey} onSummaryChange={handleSummary} />
      )}
      {sub === 'register' && (
        <BentoRegisterForm
          onMessage={setMessage}
          onRegistered={() => {
            setRefreshKey((k) => k + 1)
            setSub('stock')
          }}
        />
      )}

      <MessageModal message={message} onClose={() => setMessage(null)} />
    </div>
  )
}
