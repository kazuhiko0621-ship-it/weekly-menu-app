// Supabase Edge Function: shopping-list
//
// 指定期間の献立(Notion由来)に紐づく「DB_レシピ材料明細」の行を集計する。
//
// データ構造:
//   DB_レシピ材料明細 … レシピ(relation) / 材料(relation) / 数量(number) / 備考 / 元テキスト
//   DB_材料リスト     … 材料(title) / カテゴリー(select) / 標準単位(select) / 常備調味料(checkbox=計上不要)
//
// リクエスト: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
//
// 必要な secrets:
//   NOTION_TOKEN                     (notion-search と共通)
//   NOTION_DETAIL_DB_ID              DB_レシピ材料明細のID
//   NOTION_INGREDIENT_DB_ID          DB_材料リストのID

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')
const DETAIL_DB_ID = Deno.env.get('NOTION_DETAIL_DB_ID')
const INGREDIENT_DB_ID = Deno.env.get('NOTION_INGREDIENT_DB_ID')
const NOTION_VERSION = '2022-06-28'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// カテゴリの表示順(ここに無いものは最後にまとめる)
const CATEGORY_ORDER = [
  '野菜', 'きのこ', '海藻', '果物',
  '肉', '鶏肉', '豚肉', '牛肉', '加工肉', '魚',
  '大豆食品', '乳製品', '炭水化物',
  '調味料', 'スパイス', 'その他',
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const bare = (id: string) => (id ?? '').replace(/-/g, '').toLowerCase()

async function notionQueryAll(dbId: string) {
  const rows: any[] = []
  let cursor: string | undefined = undefined
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Notion取得失敗(${dbId}): ${JSON.stringify(data)}`)
    rows.push(...(data.results ?? []))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)
  return rows
}

const plain = (prop: any): string => {
  if (!prop) return ''
  if (prop.type === 'title') return (prop.title ?? []).map((t: any) => t.plain_text).join('')
  if (prop.type === 'rich_text') return (prop.rich_text ?? []).map((t: any) => t.plain_text).join('')
  if (prop.type === 'select') return prop.select?.name ?? ''
  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN が設定されていません' }, 500)
  if (!DETAIL_DB_ID || !INGREDIENT_DB_ID) {
    return json({ error: 'NOTION_DETAIL_DB_ID / NOTION_INGREDIENT_DB_ID が設定されていません' }, 500)
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が取得できません' }, 500)
  }

  try {
    const { startDate, endDate } = await req.json()
    if (!startDate || !endDate) return json({ error: 'startDate / endDate が必要です' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: meals, error } = await supabase
      .from('meals')
      .select('date, name, notion_page_id, notion_url')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('source', 'notion')
      .not('notion_page_id', 'is', null)
    if (error) return json({ error: error.message }, 500)

    // レシピページごとの登場回数(同じレシピを2回作る予定なら材料も2倍)
    const recipeInfo = new Map<string, { title: string; url: string | null; count: number; dates: string[] }>()
    for (const m of meals ?? []) {
      const key = bare(m.notion_page_id)
      const cur = recipeInfo.get(key)
      if (cur) {
        cur.count += 1
        cur.dates.push(m.date)
      } else {
        recipeInfo.set(key, { title: m.name, url: m.notion_url ?? null, count: 1, dates: [m.date] })
      }
    }

    if (recipeInfo.size === 0) {
      return json({ groups: [], recipeSummary: [], missingDetail: [] })
    }

    // 材料マスタと明細を取得
    const [ingredientRows, detailRows] = await Promise.all([
      notionQueryAll(INGREDIENT_DB_ID),
      notionQueryAll(DETAIL_DB_ID),
    ])

    const ingredientMap = new Map<string, any>()
    for (const p of ingredientRows) {
      ingredientMap.set(bare(p.id), {
        name: plain(p.properties?.['材料']),
        category: plain(p.properties?.['カテゴリー']) || 'その他',
        unit: plain(p.properties?.['標準単位']) || '',
        skip: p.properties?.['常備調味料']?.checkbox === true,
        url: p.url,
      })
    }

    // 材料ページIDごとに集計
    type Entry = {
      ingredientId: string
      name: string
      category: string
      unit: string
      skip: boolean
      totalQty: number | null
      hasUnknownQty: boolean
      details: any[]
    }
    const entries = new Map<string, Entry>()
    const recipesWithDetail = new Set<string>()

    for (const row of detailRows) {
      const recipeRel = row.properties?.['レシピ']?.relation ?? []
      const matched = recipeRel.map((r: any) => bare(r.id)).filter((id: string) => recipeInfo.has(id))
      if (matched.length === 0) continue

      const ingRel = row.properties?.['材料']?.relation ?? []
      const ingId = ingRel[0] ? bare(ingRel[0].id) : null
      if (!ingId) continue
      const master = ingredientMap.get(ingId)
      if (!master) continue

      const qty = row.properties?.['数量']?.number ?? null
      const note = plain(row.properties?.['備考'])
      const rawText = plain(row.properties?.['元テキスト'])
      const lineTitle = plain(row.properties?.['行タイトル'])

      for (const recipeKey of matched) {
        const info = recipeInfo.get(recipeKey)!
        recipesWithDetail.add(recipeKey)

        const entry = entries.get(ingId) ?? {
          ingredientId: ingId,
          name: master.name,
          category: master.category,
          unit: master.unit,
          skip: master.skip,
          totalQty: 0,
          hasUnknownQty: false,
          details: [],
        }

        if (qty == null) {
          entry.hasUnknownQty = true
        } else {
          entry.totalQty = (entry.totalQty ?? 0) + qty * info.count
        }

        entry.details.push({
          recipeTitle: info.title,
          recipeUrl: info.url,
          occurrences: info.count,
          qty,
          lineTitle,
          note: note || null,
          rawText: rawText || null,
        })

        entries.set(ingId, entry)
      }
    }

    // 明細が1件も無かったレシピを警告として返す
    const missingDetail = Array.from(recipeInfo.entries())
      .filter(([k]) => !recipesWithDetail.has(k))
      .map(([, v]) => v.title)

    // カテゴリごとにグループ化してソート
    const byCategory = new Map<string, Entry[]>()
    for (const e of entries.values()) {
      const list = byCategory.get(e.category) ?? []
      list.push(e)
      byCategory.set(e.category, list)
    }

    const groups = Array.from(byCategory.entries())
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      }))
      .sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a.category)
        const ib = CATEGORY_ORDER.indexOf(b.category)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      })

    const recipeSummary = Array.from(recipeInfo.values()).map((v) => ({
      title: v.title,
      url: v.url,
      occurrences: v.count,
    }))

    return json({ groups, recipeSummary, missingDetail })
  } catch (e: any) {
    console.error('shopping-list error', e)
    return json({ error: e?.message ?? String(e) }, 500)
  }
})
