import { useEffect } from 'react'

// 登録/更新/削除完了などを知らせるシンプルなモーダル
export default function MessageModal({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 1400)
    return () => clearTimeout(t)
  }, [onClose])

  if (!message) return null

  return (
    <div className="message-modal-overlay" onClick={onClose}>
      <div className="message-modal">{message}</div>
    </div>
  )
}
