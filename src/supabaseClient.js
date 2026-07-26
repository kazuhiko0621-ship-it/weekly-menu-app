import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。.env を確認してください。'
  )
}

// persistSession / autoRefreshToken は既定値だが、明示しておく。
// これにより、一度ログインすればブラウザ(PWA含む)を閉じても
// セッションが保持され、再度ログイン画面を出さずに使い続けられる。
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
