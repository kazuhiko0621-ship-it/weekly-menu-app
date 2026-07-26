import { supabase } from '../supabaseClient.js'

// カテゴリー/評価の選択肢とタイトル列名を取得(編集画面を開いたときに1回だけ呼ぶ)
export async function fetchNotionMeta() {
  const { data, error } = await supabase.functions.invoke('notion-search', {
    body: { mode: 'meta' },
  })
  if (error) {
    console.error('notion-search(meta) error', error)
    return { titleProperty: null, category: null, rating: null }
  }
  return data
}

// タイトル部分一致 + カテゴリー/評価での絞り込み検索
export async function searchNotionRecipes({ query = '', categories = [], ratings = [] }) {
  if (!query.trim() && categories.length === 0 && ratings.length === 0) return []
  const { data, error } = await supabase.functions.invoke('notion-search', {
    body: { mode: 'search', query, categories, ratings },
  })
  if (error) {
    console.error('notion-search error', error)
    return []
  }
  return data?.results ?? []
}
