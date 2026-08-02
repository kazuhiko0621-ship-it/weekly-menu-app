import { supabase } from '../supabaseClient.js'

// 食べたいものリストを取得(新しい順)
export async function fetchWishlist() {
  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 新規に1件登録する
export async function insertWishlistItem({ name, notion_page_id, notion_url, place_id, source }) {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) return null
  const { data, error } = await supabase
    .from('wishlist')
    .insert({
      name: trimmed,
      notion_page_id: notion_page_id ?? null,
      notion_url: notion_url ?? null,
      place_id: place_id ?? null,
      source: source ?? 'manual',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// 1件削除する(リストから消せるのはこの操作のみ。献立に追加しても消えない)
export async function deleteWishlistItem(id) {
  const { error } = await supabase.from('wishlist').delete().eq('id', id)
  if (error) throw error
}
