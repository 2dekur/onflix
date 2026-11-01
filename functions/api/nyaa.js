export async function onRequest(context) {
  const url = new URL(context.request.url)
  const q = url.searchParams.get('q') || ''
  const r = await fetch(`https://nyaa.si/?page=rss&q=${encodeURIComponent(q)}&c=0_0&f=0`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const text = await r.text()
  return new Response(text, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300'
    }
  })
}
