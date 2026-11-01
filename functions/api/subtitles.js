const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const imdb = url.searchParams.get('imdb') || ''
  const lang = url.searchParams.get('lang') || 'fre'
  const srtUrl = url.searchParams.get('url') || ''

  // proxy SRT file download
  if (srtUrl) {
    const r = await fetch(srtUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const buf = await r.arrayBuffer()
    // decompress gzip if needed (opensubtitles sends gzipped srt)
    try {
      const ds = new DecompressionStream('gzip')
      const writer = ds.writable.getWriter()
      writer.write(new Uint8Array(buf))
      writer.close()
      const out = await new Response(ds.readable).text()
      return new Response(out, { headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch {
      return new Response(buf, { headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  }

  if (!imdb) return new Response('[]', { headers: { ...CORS, 'Content-Type': 'application/json' } })

  const r = await fetch(
    `https://rest.opensubtitles.org/search/imdbid-${imdb.replace('tt','')}/sublanguageid-${lang}`,
    { headers: { 'X-User-Agent': 'TemporaryUserAgent', 'User-Agent': 'Mozilla/5.0' } }
  )
  const text = await r.text()
  return new Response(text, {
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
  })
}
