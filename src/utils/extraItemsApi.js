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

// 既存の買い物メモを材料マスタと再照合してジャンルを更新する。
// マスタを後から整備した場合や、表記ゆれの判定を改善した場合に使う。
export async function recategorizeExtraItems() {
  const { data, error } = await supabase.functions.invoke('quick-add', {
    body: { mode: 'recategorize' },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// ── よく買うもの(定番リスト)──
// 履歴からの自動集計ではなく、ユーザーが自分で登録・削除して育てるマスタ。
// 買い物リストを片付けても消えず、余計なレコードも溜まらない。

export async function fetchStapleItems() {
  const { data, error } = await supabase
    .from('staple_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addStapleItem(name) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return null
  // 同名は登録済みとして無視する(name に unique 制約あり)
  const { data, error } = await supabase
    .from('staple_items')
    .upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteStapleItem(id) {
  const { error } = await supabase.from('staple_items').delete().eq('id', id)
  if (error) throw error
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
