// Google Places API (New) の Autocomplete を使った店舗名検索。
// APIキーはブラウザから直接呼び出す(HTTPリファラー制限で保護する想定)。
const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

// Googleが推奨する形式(query + query_place_id)でリンクを作る。
// place_idだけを渡す形式(q=place_id:...)はiOSアプリへの遷移時に
// 「一致する検索結果が見つかりませんでした」となることがあるため、
// 店名も一緒に渡して確実にヒットさせる。
export function mapsUrlForPlace(name, placeId) {
  const params = new URLSearchParams({ api: '1', query: name || '', query_place_id: placeId })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export function formatDistance(meters) {
  if (meters == null) return null
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// 現在地(ブラウザのGeolocation)を1回だけ取得してキャッシュする。
// 取得できない/拒否された場合はnullを返し、距離順は使わず通常検索にフォールバックする。
let cachedPosition = null
let positionPromise = null

function getCurrentPosition() {
  if (cachedPosition) return Promise.resolve(cachedPosition)
  if (positionPromise) return positionPromise
  positionPromise = new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPosition = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        resolve(cachedPosition)
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 5 * 60 * 1000 }
    )
  })
  return positionPromise
}

export async function searchRestaurants(query) {
  if (!API_KEY) {
    console.warn('[places] VITE_GOOGLE_PLACES_API_KEY が設定されていません。')
    return []
  }
  if (!query || query.trim().length === 0) return []

  const origin = await getCurrentPosition()

  const body = {
    input: query.trim(),
    languageCode: 'ja',
    regionCode: 'jp',
    // 以前は includedPrimaryTypes: ['restaurant'] で飲食店のみに絞り込んでいたが、
    // スパ・レジャー施設なども検索したいという要望があったため、
    // 種別による絞り込みは行わず、Google側の関連度判定に任せる
  }
  if (origin) {
    body.origin = origin
    // 現在地から半径5km圏内を優先しつつ、圏外の結果も除外はしない
    body.locationBias = { circle: { center: origin, radius: 5000 } }
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.distanceMeters',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('places autocomplete error', data)
      return []
    }
    const results = (data.suggestions ?? [])
      .filter((s) => s.placePrediction)
      .map((s) => {
        const p = s.placePrediction
        return {
          placeId: p.placeId,
          name: p.structuredFormat?.mainText?.text ?? '',
          address: p.structuredFormat?.secondaryText?.text ?? '',
          distanceMeters: p.distanceMeters ?? null,
        }
      })

    // origin(現在地)が取れているときだけ、近い順に並び替える
    if (origin) {
      results.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    }
    return results
  } catch (e) {
    console.error('places autocomplete error', e)
    return []
  }
}
