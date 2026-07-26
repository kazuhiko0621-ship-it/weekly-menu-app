import { supabase } from '../supabaseClient.js'

// 週の範囲(dateKeyの配列)に該当する献立を取得
export async function fetchMealsForWeek(dateKeys) {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .in('date', dateKeys)
  if (error) throw error
  return data ?? []
}

// 献立を1件保存(同じ date+slot があれば上書き、name が空なら削除)
export async function upsertMeal({ date, slot, name, notion_page_id, notion_url, source }) {
  const trimmed = (name ?? '').trim()

  if (trimmed.length === 0) {
    const { error } = await supabase.from('meals').delete().match({ date, slot })
    if (error) throw error
    return null
  }

  const { data, error } = await supabase
    .from('meals')
    .upsert(
      {
        date,
        slot,
        name: trimmed,
        notion_page_id: notion_page_id ?? null,
        notion_url: notion_url ?? null,
        source: source ?? 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date,slot' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// 全履歴(過去〜現在に登録された全ての献立)を取得
export async function fetchAllMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

// name の部分一致で履歴から候補を取得(直近優先・重複除去)
export async function searchHistoryMeals(query) {
  const all = await fetchAllMeals()
  const q = (query ?? '').trim().toLowerCase()
  const seen = new Map()
  for (const m of all) {
    if (q && !m.name.toLowerCase().includes(q)) continue
    if (!seen.has(m.name)) {
      seen.set(m.name, m) // 最初に出てくるもの = 最新(dateの降順で取得済み)
    }
  }
  return Array.from(seen.values())
}

// 登場回数の降順ランキングを算出
export function buildPopularRanking(allMeals) {
  const map = new Map()
  for (const m of allMeals) {
    const key = m.name
    if (!map.has(key)) {
      map.set(key, {
        name: m.name,
        count: 0,
        lastDate: m.date,
        notion_page_id: m.notion_page_id,
        notion_url: m.notion_url,
      })
    }
    const entry = map.get(key)
    entry.count += 1
    if (m.date > entry.lastDate) entry.lastDate = m.date
    // notionリンクは最新のものを優先して保持
    if (m.date >= entry.lastDate && m.notion_url) {
      entry.notion_url = m.notion_url
      entry.notion_page_id = m.notion_page_id
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}
