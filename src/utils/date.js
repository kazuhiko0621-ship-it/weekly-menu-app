// 月曜始まりの週ユーティリティ

export const SLOTS = [
  { key: 'breakfast', label: '朝' },
  { key: 'lunch', label: '昼' },
  { key: 'dinner', label: '夜' },
]

const DOW_LABEL = ['月', '火', '水', '木', '金', '土', '日']

export function toDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 指定日を含む週の月曜日を返す
export function getWeekStart(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun ... 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return {
      date: d,
      dateKey: toDateKey(d),
      dowLabel: DOW_LABEL[i],
    }
  })
}

// 2週間(14日分)の日付オブジェクトを返す
export function getTwoWeekDays(weekStart) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = addDays(weekStart, i)
    return {
      date: d,
      dateKey: toDateKey(d),
      dowLabel: DOW_LABEL[i % 7],
      dowIndex: i % 7,
    }
  })
}

// 2週間の範囲ラベル: "8/3(月) 〜 8/16(日)"
export function formatTwoWeekRange(weekStart) {
  const end = addDays(weekStart, 13)
  const dows = ['月', '火', '水', '木', '金', '土', '日']
  const fmt = (d) => {
    const dow = dows[(d.getDay() + 6) % 7]
    return `${d.getMonth() + 1}/${d.getDate()}(${dow})`
  }
  return `${fmt(weekStart)} 〜 ${fmt(end)}`
}

export function formatWeekRange(weekStart) {
  const end = addDays(weekStart, 6)
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(weekStart)} 〜 ${fmt(end)}`
}

export function isToday(dateKey) {
  return dateKey === toDateKey(new Date())
}

// 買い物リストの期間プリセット用。
// 「今日 〜 次の日曜日」。ただし今日が土日の場合は、その週末ではなく翌週の日曜日まで
// (週末に翌週分をまとめ買いする使い方に合わせている)。
export function getNextSundayFromToday(weeksAhead = 0) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay() // 0=日, 6=土
  const isWeekend = dow === 0 || dow === 6

  // 次の日曜日までの日数(今日が日曜なら7日後)
  let daysToSunday = (7 - dow) % 7
  if (daysToSunday === 0) daysToSunday = 7
  if (isWeekend) daysToSunday += 7

  return addDays(today, daysToSunday + weeksAhead * 7)
}
