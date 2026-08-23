// Supabase Edge Function: quick-add
//
// Apple Watch / iPhone の「ショートカット」アプリから、音声入力した品名を
// 買い物メモ(shopping_extra_items)に追加するための入口。
//
// ショートカットからは通常のSupabaseログインができないため、
// 合言葉(QUICK_ADD_SECRET)をヘッダー x-quick-add-secret で照合する。
//
// リクエスト: { "text": "牛乳、トイレットペーパー" }
//   読点/句点/改行/カンマ区切りで複数まとめて登録できる。
//
// 必要な secrets:
//   QUICK_ADD_SECRET          ショートカットと共有する合言葉(自分で決めた長い文字列)
//   NOTION_TOKEN              材料マスタ照合用(既存のものを流用)
//   NOTION_INGREDIENT_DB_ID   DB_材料リストのID(既存のものを流用)
//
// デプロイ時は --no-verify-jwt を付けること(ショートカットはJWTを持たないため)。

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const QUICK_ADD_SECRET = Deno.env.get('QUICK_ADD_SECRET')
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')
const INGREDIENT_DB_ID = Deno.env.get('NOTION_INGREDIENT_DB_ID')
const NOTION_VERSION = '2022-06-28'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-quick-add-secret',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// 材料マスタを取得して「材料名 → カテゴリー」の対応表を作る
async function fetchIngredientCategories(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!NOTION_TOKEN || !INGREDIENT_DB_ID) return map

  let cursor: string | undefined = undefined
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${INGREDIENT_DB_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('材料マスタ取得失敗', JSON.stringify(data))
      return map
    }
    for (const p of data.results ?? []) {
      const name = (p.properties?.['材料']?.title ?? []).map((t: any) => t.plain_text).join('').trim()
      const category = p.properties?.['カテゴリー']?.select?.name ?? null
      if (name) map.set(name, category ?? 'その他')
    }
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return map
}

// 入力文字列を品名の配列に分割する(音声入力は読点区切りになりやすい)
function splitNames(text: string): string[] {
  return text
    .split(/[、,，\n\r。]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// 旧字体・異体字の揺れを吸収するための変換表(食材まわりで実際に起きやすいものだけ)
const CHAR_VARIANTS: Record<string, string> = {
  '醬': '醤', '麵': '麺', '鷄': '鶏', '蔥': '葱', '醱': '醗',
  '麥': '麦', '壽': '寿', '蠣': '蛎', '國': '国', '菸': '煙',
  '搾': '絞', '挽': '碾',
}

// 照合用に品名を正規化する。
//  ・NFKC で全角/半角・記号の揺れを吸収
//  ・空白を除去
//  ・カタカナをひらがなに寄せる(トウバンジャン ⇄ とうばんじゃん)
//  ・旧字体を新字体に寄せる(豆板醬 ⇄ 豆板醤)
function normalizeName(s: string): string {
  let t = (s ?? '').normalize('NFKC').trim().toLowerCase()
  t = t.replace(/[\s\u3000]/g, '')
  t = t.replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
  t = t.split('').map((c) => CHAR_VARIANTS[c] ?? c).join('')
  return t
}

// 材料マスタとの照合。正規化した名前で「完全一致 → 部分一致(最長優先)」の順に探す。
// 部分一致は誤爆しやすいので2文字以上に限定している。
function resolveCategory(name: string, catalog: Map<string, string>): string | null {
  const target = normalizeName(name)
  if (!target) return null

  let bestCategory: string | null = null
  let bestLen = 0

  for (const [master, category] of catalog.entries()) {
    const m = normalizeName(master)
    if (!m) continue
    if (m === target) return category // 完全一致は即採用
    if (m.length < 2 || target.length < 2) continue
    if (target.includes(m) || m.includes(target)) {
      // より長く一致するマスタを優先する(「油」より「オリーブ油」)
      if (m.length > bestLen) {
        bestLen = m.length
        bestCategory = category
      }
    }
  }
  return bestCategory
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が取得できません' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 認証は2通り受け付ける:
  //   1) ショートカットから: 合言葉ヘッダー x-quick-add-secret
  //   2) アプリから: ログイン済みユーザーのJWT(Authorization: Bearer ...)
  let authorized = false

  const provided = req.headers.get('x-quick-add-secret')
  if (QUICK_ADD_SECRET && provided === QUICK_ADD_SECRET) {
    authorized = true
  }

  if (!authorized) {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token) {
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data?.user) authorized = true
    }
  }

  if (!authorized) return json({ error: '認証に失敗しました' }, 401)

  try {
    const body = await req.json().catch(() => ({}))

    // 既存の買い物メモを材料マスタと再照合してカテゴリを更新するモード。
    // マスタを後から整備した場合や、表記ゆれの判定を改善した場合に使う。
    if (body.mode === 'recategorize') {
      const catalog = await fetchIngredientCategories()
      if (catalog.size === 0) {
        return json({ error: '材料マスタを取得できませんでした' }, 500)
      }
      const { data: existing, error: fetchErr } = await supabase
        .from('shopping_extra_items')
        .select('id, name, category')
      if (fetchErr) return json({ error: fetchErr.message }, 500)

      let updated = 0
      for (const row of existing ?? []) {
        const next = resolveCategory(row.name, catalog)
        if (next && next !== row.category) {
          const { error } = await supabase
            .from('shopping_extra_items')
            .update({ category: next })
            .eq('id', row.id)
          if (!error) updated += 1
        }
      }
      return json({ ok: true, updated, message: `${updated}件のジャンルを更新しました` })
    }

    const names = splitNames(body.text ?? '')
    if (names.length === 0) return json({ error: '品名が空です' }, 400)

    const catalog = await fetchIngredientCategories()

    const rows = names.map((name) => ({
      name,
      category: resolveCategory(name, catalog),
      checked: false,
    }))

    const { error } = await supabase.from('shopping_extra_items').insert(rows)
    if (error) return json({ error: error.message }, 500)

    return json({
      ok: true,
      added: rows.map((r) => r.name),
      message: `${rows.map((r) => r.name).join('、')} を追加しました`,
    })
  } catch (e: any) {
    console.error('quick-add error', e)
    return json({ error: e?.message ?? String(e) }, 500)
  }
})
