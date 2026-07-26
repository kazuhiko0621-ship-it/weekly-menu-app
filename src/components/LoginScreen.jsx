import { useState } from 'react'
import { supabase } from '../supabaseClient.js'

// 家族(夫婦)専用のログイン画面。
// 新規登録UIはあえて用意していない(アカウントはSupabaseダッシュボードから
// 管理者が2人分だけ手動で作成する運用のため)。
export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('メールアドレスかパスワードが正しくありません')
  }

  return (
    <div className="login-screen">
      <h1 className="login-title">週間献立</h1>
      <p className="login-sub">共有アカウントでログインしてください</p>
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}
