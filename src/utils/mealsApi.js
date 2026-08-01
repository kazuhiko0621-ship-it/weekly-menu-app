import { supabase } from '../supabaseClient.js'

export const EACH_SOURCE = 'each' // 「各自」を表すsource値(献立としては扱わない)

// Googleカレンダーへの同期(失敗しても献立管理そのものは止めない)
async function syncMealToCalendar(meal) {
  try {
    const { data, error } = await supabase.functions.invoke('calendar-sync', {
      body: { mode: 'upsert', meal },
    })
    if (error) {
      console.error('calendar-sync(upsert) error', error)
      return null
    }
    return data
  } catch (e) {
    console.error('calendar-sync(upsert) error', e)
    return null
  }
}

async function deleteMealFromCalendar(googleEventId) {
  if (!googleEventId) return
  try {
    const { error } = await supabase.functions.invoke('calendar-sync', {
      body: { mode: 'delete', google_event_id: googleEventId },
    })
    if (error) console.error('calendar-sync(delete) error', error)
  } catch (e) {
    console.error('calendar-sync(delete) error', e)
  }
}

// 週の範囲(dateKeyの配列)に該当する献立を取得(同じ日・同じコマに複数件ある場合もある)
export async function fetchMealsForWeek(dateKeys) {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .in('date', dateKeys)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// 新規に1件登録する(同じ日・同じコマに既にレコードがあっても追加登録される)
// 登録後、Googleカレンダーにも予定を作成する
export async function insertMeal({ date, slot, name, notion_page_id, notion_url, source }) {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) return null
  const { data, error } = await supabase
    .from('meals')
    .insert({
      date,
      slot,
      name: trimmed,
      notion_page_id: notion_page_id ?? null,
      notion_url: notion_url ?? null,
      source: source ?? 'manual',
    })
    .select()
    .single()
  if (error) throw error

  const synced = await syncMealToCalendar(data)
  if (synced?.google_event_id) data.google_event_id = synced.google_event_id
  return data
}

// 既存の1件を更新する。Googleカレンダー側の予定も合わせて更新する
export async function updateMeal(id, { name, notion_page_id, notion_url, source }) {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) return null
  const { data, error } = await supabase
    .from('meals')
    .update({
      name: trimmed,
      notion_page_id: notion_page_id ?? null,
      notion_url: notion_url ?? null,
      source: source ?? 'manual',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await syncMealToCalendar(data)
  return data
}

// 1件削除する。Googleカレンダー側の予定も削除する
export async function deleteMeal(meal) {
  await deleteMealFromCalendar(meal.google_event_id)
  const { error } = await supabase.from('meals').delete().eq('id', meal.id)
  if (error) throw error
}

// 別の日付に移動する(ドラッグ&ドロップでの曜日移動用)。Googleカレンダーの予定日時も更新する
export async function moveMealToDate(id, newDate) {
  const { data, error } = await supabase
    .from('meals')
    .update({ date: newDate, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await syncMealToCalendar(data)
  return data
}

// 全履歴(過去〜現在に登録された全ての献立)を取得。「各自」は献立として扱わないため除外する
export async function fetchAllMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .neq('source', EACH_SOURCE)
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

// 登場回数の降順ランキングを算出(fetchAllMeals側で「各自」は除外済み)
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
