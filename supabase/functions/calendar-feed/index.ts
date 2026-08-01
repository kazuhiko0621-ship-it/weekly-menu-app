// Supabase Edge Function: calendar-feed
//
// 献立データを iCalendar(.ics)形式で配信する。
// GoogleカレンダーなどでこのURLを「URLで追加(購読)」すると、
// 献立が自動的にカレンダーに反映される(反映まで半日〜1日程度のタイムラグあり)。
//
// アクセス制御はURLに埋め込む簡易トークン方式(?token=...)。
// 事前に以下のsecretを設定しておくこと:
//   supabase secrets set CALENDAR_FEED_TOKEN=好きなランダム文字列
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase Edge Functions が
// 自動的に用意する環境変数なので、こちらで設定する必要はない。
// (このFunctionは認証なしの外部アクセスを許可するため、
//  RLSを回避できるservice roleキーでデータを取得している)

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FEED_TOKEN = Deno.env.get('CALENDAR_FEED_TOKEN')

const SLOT_INFO: Record<string, { label: string; time: string }> = {
  breakfast: { label: '朝', time: '07:00' },
  lunch: { label: '昼', time: '12:00' },
  dinner: { label: '夜', time: '19:00' },
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// 日本時間の日付+時刻から、ICSで使うUTC基準の日時文字列(YYYYMMDDTHHMMSSZ)を作る
function toICSDateTime(dateStr: string, timeStr: string, addMinutes = 0) {
  const dt = new Date(`${dateStr}T${timeStr}:00+09:00`)
  dt.setUTCMinutes(dt.getUTCMinutes() + addMinutes)
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  )
}

function escapeText(s: string) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!FEED_TOKEN || token !== FEED_TOKEN) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)

  // カレンダーが際限なく肥大化しないよう、直近2週間〜90日先までに絞る
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 14)
  const end = new Date(today)
  end.setDate(end.getDate() + 90)
  const toKey = (d: Date) => d.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .gte('date', toKey(start))
    .lte('date', toKey(end))
    .order('date', { ascending: true })

  if (error) {
    return new Response('Error: ' + JSON.stringify(error), { status: 500 })
  }

  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Weekly Menu App//JP')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('X-WR-CALNAME:週間献立')

  for (const m of data ?? []) {
    const slot = SLOT_INFO[m.slot] ?? { label: m.slot, time: '12:00' }
    const isEach = m.source === 'each'
    const summary = isEach ? `${slot.label}: 各自` : `${slot.label}: ${m.name}`
    const description = !isEach && m.notion_url ? `Notion: ${m.notion_url}` : ''

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${m.id}@weekly-menu-app`)
    lines.push(`DTSTAMP:${toICSDateTime(m.date, slot.time)}`)
    lines.push(`DTSTART:${toICSDateTime(m.date, slot.time)}`)
    lines.push(`DTEND:${toICSDateTime(m.date, slot.time, 30)}`)
    lines.push(`SUMMARY:${escapeText(summary)}`)
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
