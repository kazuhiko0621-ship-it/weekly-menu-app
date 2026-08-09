// Supabase Edge Function: shopping-list
//
// 指定期間の献立(Notion由来のもののみ)から、各レシピページの
// 「機械用YAML」列(schema: notion-recipe-ingredients/v1)を取得・パースし、
// 材料を集計して返す。
//
// リクエスト: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
//
// 事前に NOTION_TOKEN / NOTION_DATABASE_ID が設定されていること(notion-searchと共通)。
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は自動で渡される。

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { parse as parseYaml } from 'https://deno.land/std@0.192.0/yaml/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')
const NOTION_VERSION = '2022-06-28'
const YAML_PROPERTY_NAME = '機械用YAML'
const EXPECTED_SCHEMA = 'notion-recipe-ingredients/v1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function fetchYamlText(pageId: string): Promise<string> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Notion取得失敗: ${JSON.stringify(data)}`)
  const prop = data.properties?.[YAML_PROPERTY_NAME]
  const text = (prop?.rich_text ?? []).map((t: any) => t.plain_text).join('')
  if (!text) throw new Error(`「${YAML_PROPERTY_NAME}」列が空です`)
  return text
}

function normUnit(u: string | null | undefined) {
  if (!u) return null
  return u.trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN が設定されていません' }, 500)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が取得できません' }, 500)
  }

  try {
    const { startDate, endDate } = await req.json()
    if (!startDate || !endDate) return json({ error: 'startDate / endDate が必要です' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: meals, error } = await supabase
      .from('meals')
      .select('name, notion_page_id, source')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('source', 'notion')
      .not('notion_page_id', 'is', null)

    if (error) return json({ error: error.message }, 500)

    // notion_page_id ごとの出現回数(同じレシピを複数回作る予定なら材料も倍必要なため)
    const occurrenceCount = new Map<string, number>()
    const displayName = new Map<string, string>()
    for (const m of meals ?? []) {
      occurrenceCount.set(m.notion_page_id, (occurrenceCount.get(m.notion_page_id) ?? 0) + 1)
      if (!displayName.has(m.notion_page_id)) displayName.set(m.notion_page_id, m.name)
    }

    const warnings: { recipeTitle: string; reason: string }[] = []
    const recipeSummary: { title: string; occurrences: number }[] = []

    const toBuyMap = new Map<string, { name: string; unit: string; qty: number; recipes: Set<string> }>()
    const rangeItems: any[] = []
    const optionalMap = new Map<string, { name: string; notes: Set<string>; recipes: Set<string> }>()
    const unclearItems: any[] = []

    for (const [pageId, count] of occurrenceCount.entries()) {
      const fallbackTitle = displayName.get(pageId) ?? '(不明なレシピ)'
      let items: any[] = []
      let title = fallbackTitle
      try {
        const yamlText = await fetchYamlText(pageId)
        const parsed: any = parseYaml(yamlText)
        const root = parsed?.machine_ingredients
        if (!root) throw new Error('machine_ingredients が見つかりません')
        if (root.schema !== EXPECTED_SCHEMA) {
          warnings.push({ recipeTitle: fallbackTitle, reason: `想定外のschema: ${root.schema}` })
        }
        title = root.source?.recipe_title ?? fallbackTitle
        items = Array.isArray(root.items) ? root.items : []
      } catch (e: any) {
        warnings.push({ recipeTitle: fallbackTitle, reason: e?.message ?? String(e) })
        continue
      }

      recipeSummary.push({ title, occurrences: count })

      for (const it of items) {
        const name = (it.name ?? '').trim()
        if (!name) continue
        const unit = normUnit(it.unit)

        if (it.optional === true || it.qty == null && it.qty_min == null && it.qty_max == null) {
          const key = name
          const entry = optionalMap.get(key) ?? { name, notes: new Set(), recipes: new Set() }
          if (it.note) entry.notes.add(it.note)
          entry.recipes.add(title)
          optionalMap.set(key, entry)
          continue
        }

        if (it.qty_min != null || it.qty_max != null) {
          rangeItems.push({
            name,
            unit,
            qtyMin: it.qty_min,
            qtyMax: it.qty_max,
            note: it.note ?? null,
            recipeTitle: title,
            occurrences: count,
          })
          continue
        }

        if (typeof it.qty === 'number' && unit) {
          const key = `${name}|${unit}`
          const entry = toBuyMap.get(key) ?? { name, unit, qty: 0, recipes: new Set() }
          entry.qty += it.qty * count
          entry.recipes.add(title)
          toBuyMap.set(key, entry)
          continue
        }

        // どのパターンにも当てはまらない場合は raw のまま「要確認」に回す(情報ロス防止)
        unclearItems.push({ name, raw: it.raw ?? null, recipeTitle: title })
      }
    }

    return json({
      toBuy: Array.from(toBuyMap.values()).map((v) => ({ ...v, recipes: Array.from(v.recipes) })),
      rangeItems,
      optionalItems: Array.from(optionalMap.values()).map((v) => ({
        ...v,
        notes: Array.from(v.notes),
        recipes: Array.from(v.recipes),
      })),
      unclearItems,
      warnings,
      recipeSummary,
    })
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500)
  }
})
