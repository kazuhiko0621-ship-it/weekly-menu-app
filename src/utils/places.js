// Google Places API (New) の Autocomplete を使った店舗名検索。
// APIキーはブラウザから直接呼び出す(HTTPリファラー制限で保護する想定)。
const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

export function mapsUrlForPlaceId(placeId) {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`
}

export async function searchRestaurants(query) {
  if (!API_KEY) {
    console.warn('[places] VITE_GOOGLE_PLACES_API_KEY が設定されていません。')
    return []
  }
  if (!query || query.trim().length === 0) return []

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input: query.trim(),
        languageCode: 'ja',
        regionCode: 'jp',
        includedPrimaryTypes: ['restaurant'],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('places autocomplete error', data)
      return []
    }
    return (data.suggestions ?? [])
      .filter((s) => s.placePrediction)
      .map((s) => {
        const p = s.placePrediction
        return {
          placeId: p.placeId,
          name: p.structuredFormat?.mainText?.text ?? '',
          address: p.structuredFormat?.secondaryText?.text ?? '',
        }
      })
  } catch (e) {
    console.error('places autocomplete error', e)
    return []
  }
}
