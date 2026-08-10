import { supabase } from '../supabaseClient.js'

const ROW_ID = 'current'

// Edge Functionを呼び出し、指定期間の材料明細を集計する(保存はしない)
export async function generateShoppingList(startDate, endDate) {
  const { data, error } = await supabase.functions.invoke('shopping-list', {
    body: { startDate, endDate },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// 集計結果にチェック状態を付けて保存(常に最新の1件のみ)
export async function saveShoppingList(startDate, endDate, result) {
  const items = {
    groups: (result.groups ?? []).map((g) => ({
      ...g,
      items: g.items.map((it) => ({ ...it, checked: false })),
    })),
  }

  const { error } = await supabase.from('shopping_list').upsert({
    id: ROW_ID,
    start_date: startDate,
    end_date: endDate,
    generated_at: new Date().toISOString(),
    items,
    warnings: result.missingDetail ?? [],
    recipe_summary: result.recipeSummary ?? [],
  })
  if (error) throw error
  return items
}

// 保存済みの最新リストを取得(未生成なら null)
export async function fetchShoppingList() {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('id', ROW_ID)
    .maybeSingle()
  if (error) throw error
  return data
}

// 1材料のチェック状態を保存する
export async function toggleShoppingItem(ingredientId, checked) {
  const current = await fetchShoppingList()
  if (!current) return
  const items = {
    groups: (current.items?.groups ?? []).map((g) => ({
      ...g,
      items: g.items.map((it) => (it.ingredientId === ingredientId ? { ...it, checked } : it)),
    })),
  }
  const { error } = await supabase.from('shopping_list').update({ items }).eq('id', ROW_ID)
  if (error) throw error
}
