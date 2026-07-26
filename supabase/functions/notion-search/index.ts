// Supabase Edge Function: notion-search
//
// 2つのモードで動作する:
//   mode: "meta"   → タイトル列名、「カテゴリー」「評価」列の選択肢一覧を返す
//   mode: "search"(既定) → タイトル部分一致 + カテゴリー/評価での絞り込み検索
//
// 事前に以下の secrets を設定してください:
//   supabase secrets set NOTION_TOKEN=secret_xxx NOTION_DATABASE_ID=xxxxxxxx

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')
const NOTION_DATABASE_ID = Deno.env.get('NOTION_DATABASE_ID')
const NOTION_VERSION = '2022-06-28'

const CATEGORY_PROP_NAME = 'カテゴリー'
const RATING_PROP_NAME = '評価'

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

async function fetchSchema() {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
    },
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, body: data }
  return data
}

function extractOptions(prop: any) {
  if (!prop) return null
  if (prop.type === 'select') {
    return { name: prop.name ?? undefined, type: 'select', options: prop.select?.options ?? [] }
  }
  if (prop.type === 'multi_select') {
    return {
      name: prop.name ?? undefined,
      type: 'multi_select',
      options: prop.multi_select?.options ?? [],
    }
  }
  if (prop.type === 'status') {
    return { name: prop.name ?? undefined, type: 'status', options: prop.status?.options ?? [] }
  }
  // number/formula など選択肢を持たない型は options を返せない
  return { name: prop.name ?? undefined, type: prop.type, options: [] }
}

function findTitlePropName(properties: Record<string, any>) {
  const entry = Object.entries(properties).find(([, p]: any) => p.type === 'title')
  return entry ? entry[0] : null
}

function getPlainText(prop: any): string {
  if (!prop) return ''
  if (prop.type === 'title') return (prop.title ?? []).map((t: any) => t.plain_text).join('')
  if (prop.type === 'select') return prop.select?.name ?? ''
  if (prop.type === 'multi_select') return (prop.multi_select ?? []).map((o: any) => o.name).join(', ')
  if (prop.type === 'status') return prop.status?.name ?? ''
  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    return json({ error: 'NOTION_TOKEN / NOTION_DATABASE_ID が設定されていません' }, 500)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode ?? 'search'

    const db = await fetchSchema()
    const properties = db.properties ?? {}
    const titleProp = findTitlePropName(properties)
    const categoryInfo = extractOptions(properties[CATEGORY_PROP_NAME])
    const ratingInfo = extractOptions(properties[RATING_PROP_NAME])

    if (mode === 'meta') {
      return json({
        titleProperty: titleProp,
        category: categoryInfo,
        rating: ratingInfo,
      })
    }

    // --- search ---
    const query: string = (body.query ?? '').trim()
    const categories: string[] = Array.isArray(body.categories) ? body.categories : []
    const ratings: string[] = Array.isArray(body.ratings) ? body.ratings : []

    const andFilters: any[] = []

    if (query && titleProp) {
      andFilters.push({ property: titleProp, title: { contains: query } })
    }

    if (categories.length > 0 && categoryInfo && categoryInfo.options.length > 0) {
      if (categoryInfo.type === 'multi_select') {
        andFilters.push({
          or: categories.map((c) => ({ property: CATEGORY_PROP_NAME, multi_select: { contains: c } })),
        })
      } else if (categoryInfo.type === 'select' || categoryInfo.type === 'status') {
        andFilters.push({
          or: categories.map((c) => ({
            property: CATEGORY_PROP_NAME,
            [categoryInfo.type]: { equals: c },
          })),
        })
      }
    }

    if (ratings.length > 0 && ratingInfo && ratingInfo.options.length > 0) {
      if (ratingInfo.type === 'multi_select') {
        andFilters.push({
          or: ratings.map((r) => ({ property: RATING_PROP_NAME, multi_select: { contains: r } })),
        })
      } else if (ratingInfo.type === 'select' || ratingInfo.type === 'status') {
        andFilters.push({
          or: ratings.map((r) => ({ property: RATING_PROP_NAME, [ratingInfo.type]: { equals: r } })),
        })
      }
    }

    const queryBody: any = { page_size: 30 }
    if (andFilters.length === 1) queryBody.filter = andFilters[0]
    else if (andFilters.length > 1) queryBody.filter = { and: andFilters }

    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      }
    )
    const data = await notionRes.json()
    if (!notionRes.ok) return json({ error: data }, notionRes.status)

    const results = (data.results || []).map((page: any) => {
      const name = titleProp ? getPlainText(page.properties[titleProp]) : ''
      const category = getPlainText(page.properties[CATEGORY_PROP_NAME])
      const rating = getPlainText(page.properties[RATING_PROP_NAME])
      return { id: page.id, name, url: page.url, category, rating }
    })

    return json({ results })
  } catch (e: any) {
    const status = e?.status ?? 500
    return json({ error: e?.body ?? String(e) }, status)
  }
})
