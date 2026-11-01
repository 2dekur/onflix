export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/nyaa') {
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

    return env.ASSETS.fetch(request)
  }
}
