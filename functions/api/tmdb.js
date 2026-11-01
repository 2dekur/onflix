export async function onRequest(context) {
  const url = new URL(context.request.url)
  const path = url.searchParams.get('path') || ''
  const key = context.env.TMDB_KEY

  if (!key) return new Response(JSON.stringify({ error: 'TMDB_KEY not set' }), { status: 500 })
  if (!path.startsWith('/')) return new Response(JSON.stringify({ error: 'bad path' }), { status: 400 })

  const tmdbUrl = new URL('https://api.themoviedb.org/3' + path)
  tmdbUrl.searchParams.set('api_key', key)
  for (const [k, v] of url.searchParams) {
    if (k !== 'path') tmdbUrl.searchParams.set(k, v)
  }

  const r = await fetch(tmdbUrl)
  const text = await r.text()
  return new Response(text, {
    status: r.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300'
    }
  })
}
