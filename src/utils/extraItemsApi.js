import { supabase } from '../supabaseClient.js'

// 材料マスタのカテゴリ表示順(shopping-list Edge Function と揃えている)
export const CATEGORY_ORDER = [
  '野菜', 'きのこ', '海藻', '果物',
  '肉', '鶏肉', '豚肉', '牛肉', '加工肉', '魚',
  '大豆食品', '乳製品', '炭水化物',
  '調味料', 'スパイス', 'その他',
]

// 手動追加の買い物メモを取得(新しい順)
export async function fetchExtraItems() {
  const { data, error } = await supabase
    .from('shopping_extra_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 品名を追加する。材料マスタとの照合(カテゴリ付与)はEdge Function側で行うため、
// ショートカットからの音声入力と同じ quick-add を呼ぶ。
// アプリからの呼び出しはログイン済みユーザーのJWTで認証される。
export async function addExtraItems(text) {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return []
  const { data, error } = await supabase.functions.invoke('quick-add', {
    body: { text: trimmed },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.added ?? []
}

// チェック状態の切り替え
export async function toggleExtraItem(id, checked) {
  const { error } = await supabase.from('shopping_extra_items').update({ checked }).eq('id', id)
  if (error) throw error
}

// 1件削除
export async function deleteExtraItem(id) {
  const { error } = await supabase.from('shopping_extra_items').delete().eq('id', id)
  if (error) throw error
}

// チェック済みをまとめて削除
export async function deleteCheckedExtraItems() {
  const { error } = await supabase.from('shopping_extra_items').delete().eq('checked', true)
  if (error) throw error
}

// よく買うもの: 過去の手動登録の履歴から、登録回数の多い順に上位を返す。
// マスタを別途メンテしなくても、使うほど自分の定番に馴染む。
export async function fetchFrequentItems(limit = 12) {
  const { data, error } = await supabase
    .from('shopping_extra_items')
    .select('name')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error

  const counts = new Map()
  for (const row of data ?? []) {
    const name = (row.name ?? '').trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

// カテゴリごとにグループ化(マスタに無いものは「その他」へ)
export function groupExtraItems(items) {
  const byCategory = new Map()
  for (const it of items) {
    const key = it.category || 'その他'
    const list = byCategory.get(key) ?? []
    list.push(it)
    byCategory.set(key, list)
  }
  return Array.from(byCategory.entries())
    .map(([category, list]) => ({ category, items: list }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category)
      const ib = CATEGORY_ORDER.indexOf(b.category)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
}
