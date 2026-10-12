import { supabase } from '../supabaseClient.js'

// 作ってから何日で注意喚起するか(3週間)
export const STALE_DAYS = 21

// 在庫が残っているロットを、作った日の古い順に取得する
export async function fetchBentoStock() {
  const { data, error } = await supabase
    .from('bento_stock')
    .select('*')
    .gt('remaining', 0)
    .order('made_on', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// 作りおきを1ロット登録する
export async function addBentoLot({ notion_page_id, name, notion_url, made_on, count }) {
  const n = Number(count)
  if (!notion_page_id || !name || !made_on) return null
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('食数は1〜10で指定してください')

  const { data, error } = await supabase
    .from('bento_stock')
    .insert({
      notion_page_id,
      name,
      notion_url: notion_url ?? null,
      made_on,
      made_count: n,
      remaining: n,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// 指定ロットの残数を1つ減らす。競合で負の値にならないよう、
// 現在値と一致する行だけを更新する(楽観的ロック)。
export async function consumeBentoLot(lot) {
  if (lot.remaining <= 0) return null
  const { data, error } = await supabase
    .from('bento_stock')
    .update({ remaining: lot.remaining - 1 })
    .eq('id', lot.id)
    .eq('remaining', lot.remaining)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// 消費の取り消し(1つ戻す)。作った食数は超えないようにする。
export async function undoConsumeBentoLot(lot) {
  const next = Math.min((lot.remaining ?? 0) + 1, lot.made_count)
  const { data, error } = await supabase
    .from('bento_stock')
    .update({ remaining: next })
    .eq('id', lot.id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// 誤登録したロットを削除する
export async function deleteBentoLot(id) {
  const { error } = await supabase.from('bento_stock').delete().eq('id', id)
  if (error) throw error
}

// 作った日からの経過日数
export function daysSince(dateStr) {
  const made = new Date(`${dateStr}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today - made) / 86400000))
}

// 「10/8」のような短い日付表記
export function formatMadeOn(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
