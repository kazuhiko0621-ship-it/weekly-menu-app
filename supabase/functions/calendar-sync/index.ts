// Supabase Edge Function: calendar-sync
//
// 献立の登録/更新/削除/移動をGoogleカレンダーへ即時反映する。
//
// mode: "upsert" → { meal: {...} } を受け取り、Googleカレンダーに予定を作成/更新し、
//        新規作成時はイベントIDを meals.google_event_id に書き戻す
// mode: "delete" → { google_event_id } を受け取り、該当予定を削除する
//
// 事前に以下の secrets を設定してください:
//   supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx \
//     GOOGLE_REFRESH_TOKEN=xxx GOOGLE_CALENDAR_ID=xxx
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY はSupabaseが自動で環境変数に
// 設定してくれるため、こちらで別途secretsを設定する必要はない。

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN')
const GOOGLE_CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') ?? 'primary'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SLOT_LABEL: Record<string, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食' }
const SLOT_TIME: Record<string, { start: string; end: string }> = {
  breakfast: { start: '07:00:00', end: '07:30:00' },
  lunch: { start: '12:00:00', end: '13:00:00' },
  dinner: { start: '19:00:00', end: '20:00:00' },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID ?? '',
      client_secret: GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: GOOGLE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, body: data }
  return data.access_token as string
}

function buildEvent(meal: any) {
  const label = SLOT_LABEL[meal.slot] ?? meal.slot
  const time = SLOT_TIME[meal.slot] ?? SLOT_TIME.dinner
  const name = meal.source === 'each' ? '各自' : meal.name

  return {
    summary: `${label}: ${name}`,
    description: meal.notion_url ? meal.notion_url : undefined,
    start: { dateTime: `${meal.date}T${time.start}+09:00`, timeZone: 'Asia/Tokyo' },
    end: { dateTime: `${meal.date}T${time.end}+09:00`, timeZone: 'Asia/Tokyo' },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN が設定されていません' }, 500)
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が取得できません' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode ?? 'upsert'
    const accessToken = await getAccessToken()

    if (mode === 'delete') {
      const eventId = body.google_event_id
      if (!eventId) return json({ ok: true, skipped: true })

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      )
      // 404/410 = 既に削除済み。それ以外の失敗はエラーとして返す
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const data = await res.json().catch(() => ({}))
        return json({ error: data }, res.status)
      }
      return json({ ok: true })
    }

    // --- upsert ---
    const meal = body.meal
    if (!meal?.id) return json({ error: 'meal が指定されていません' }, 400)

    const event = buildEvent(meal)
    const existingId = meal.google_event_id

    let notionRes
    if (existingId) {
      notionRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${existingId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      )
    } else {
      notionRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      )
    }

    const data = await notionRes.json()

    // 更新対象イベントが(手動削除などで)見つからない場合は新規作成にフォールバックする
    if (!notionRes.ok && existingId && (notionRes.status === 404 || notionRes.status === 410)) {
      const retryRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      )
      const retryData = await retryRes.json()
      if (!retryRes.ok) return json({ error: retryData }, retryRes.status)
      await supabase.from('meals').update({ google_event_id: retryData.id }).eq('id', meal.id)
      return json({ ok: true, google_event_id: retryData.id })
    }

    if (!notionRes.ok) return json({ error: data }, notionRes.status)

    if (!existingId) {
      await supabase.from('meals').update({ google_event_id: data.id }).eq('id', meal.id)
    }

    return json({ ok: true, google_event_id: data.id })
  } catch (e: any) {
    const status = e?.status ?? 500
    return json({ error: e?.body ?? String(e) }, status)
  }
})
