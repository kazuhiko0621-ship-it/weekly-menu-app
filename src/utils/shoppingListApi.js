import { supabase } from '../supabaseClient.js'

const ROW_ID = 'current'

// Edge Functionを呼び出し、指定期間の材料を集計する(保存はしない)
export async function generateShoppingList(startDate, endDate) {
  const { data, error } = await supabase.functions.invoke('shopping-list', {
    body: { startDate, endDate },
  })
  if (error) throw error
  return data
}

// 集計結果にチェック状態(checked)とkeyを付与してから保存する
export async function saveShoppingList(startDate, endDate, result) {
  const withKeys = {
    toBuy: (result.toBuy ?? []).map((it, i) => ({ ...it, key: `buy-${i}`, checked: false })),
    rangeItems: (result.rangeItems ?? []).map((it, i) => ({ ...it, key: `range-${i}`, checked: false })),
    optionalItems: (result.optionalItems ?? []).map((it, i) => ({ ...it, key: `opt-${i}`, checked: false })),
    unclearItems: (result.unclearItems ?? []).map((it, i) => ({ ...it, key: `unclear-${i}` })),
  }

  const { error } = await supabase.from('shopping_list').upsert({
    id: ROW_ID,
    start_date: startDate,
    end_date: endDate,
    generated_at: new Date().toISOString(),
    items: withKeys,
    warnings: result.warnings ?? [],
    recipe_summary: result.recipeSummary ?? [],
  })
  if (error) throw error
  return withKeys
}

// 保存済みの最新リストを取得(まだ生成したことが無ければ null)
export async function fetchShoppingList() {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('id', ROW_ID)
    .maybeSingle()
  if (error) throw error
  return data
}

// 1項目のチェック状態を更新する
export async function toggleShoppingItem(section, key, checked) {
  const current = await fetchShoppingList()
  if (!current) return
  const items = { ...current.items }
  items[section] = (items[section] ?? []).map((it) => (it.key === key ? { ...it, checked } : it))
  const { error } = await supabase.from('shopping_list').update({ items }).eq('id', ROW_ID)
  if (error) throw error
}
