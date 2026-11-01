window.Sources = {

  // ── torrent sources ──────────────────────────────────────────────────────

  async yts(title, year) {
    const r = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(title)}&limit=5`)
    const j = await r.json()
    const movies = j.data?.movies || []
    const match = movies.find(m => String(m.year) === String(year)) || movies[0]
    if (!match) return []
    return (match.torrents || [])
      .sort((a, b) => {
        const q = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 }
        return (q[b.quality] || 0) - (q[a.quality] || 0)
      })
      .map(t => ({ label: `YTS ${t.quality} ${t.type}`, magnet: this._ytsM(match.imdb_code, t.hash), size: t.size, seeds: t.seeds, source: 'yts' }))
  },

  _ytsM(imdb, hash) {
    return `magnet:?xt=urn:btih:${hash}&dn=${imdb}&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80`
  },

  async eztv(imdbId, season, episode) {
    const r = await fetch(`https://eztv.re/api/get-torrents?imdb_id=${imdbId.replace('tt', '')}&limit=20`)
    const j = await r.json()
    const eps = (j.torrents || []).filter(t => t.season == season && t.episode == episode)
    return eps.map(t => ({ label: `EZTV ${t.title}`, magnet: t.magnet_url, seeds: t.seeds, source: 'eztv' }))
  },

  async nyaa(title) {
    // proxied through Cloudflare Pages Function to avoid CORS
    const r = await fetch(`/api/nyaa?q=${encodeURIComponent(title + ' 1080p')}`)
    const text = await r.text()
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    const items = [...doc.querySelectorAll('item')].slice(0, 8)
    return items.map(el => ({
      label: el.querySelector('title')?.textContent || 'Nyaa',
      magnet: el.querySelector('link')?.textContent || el.querySelector('enclosure')?.getAttribute('url') || '',
      source: 'nyaa'
    })).filter(t => t.magnet.startsWith('magnet:'))
  },

  async tpb(query) {
    try {
      const r = await fetch(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`)
      const j = await r.json()
      return (j || []).slice(0, 6).map(t => ({
        label: `TPB ${t.name}`,
        magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}`,
        seeds: parseInt(t.seeders) || 0,
        source: 'tpb'
      })).filter(t => t.seeds > 0)
    } catch { return [] }
  },

  // ── embed fallbacks ──────────────────────────────────────────────────────

  embedUrls(imdbId, tmdbId, type, season, episode) {
    const s = season || 1, e = episode || 1
    const urls = []
    if (imdbId) {
      if (type === 'movie') {
        urls.push({ label: 'VidSrc',    url: `https://vidsrc.me/embed/movie?imdb=${imdbId}` })
        urls.push({ label: '2Embed',    url: `https://www.2embed.cc/embed/${imdbId}` })
        urls.push({ label: 'SuperEmbed',url: `https://multiembed.mov/?video_id=${imdbId}&tmdb=0` })
      } else {
        urls.push({ label: 'VidSrc',    url: `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` })
        urls.push({ label: '2Embed',    url: `https://www.2embed.cc/embedtv/${imdbId}&s=${s}&e=${e}` })
      }
    }
    if (tmdbId) {
      if (type === 'movie') {
        urls.push({ label: 'VidSrc TMDB', url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` })
      } else {
        urls.push({ label: 'VidSrc TMDB', url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` })
      }
    }
    return urls
  },

  // ── unified entry point ──────────────────────────────────────────────────

  async getAllTorrent(item, details, season, episode) {
    const type = TMDB.type(item)
    const title = TMDB.title(item)
    const year  = TMDB.year(item)
    const imdbId = TMDB.imdbId(details)
    const results = []

    if (type === 'movie') {
      const [yts, tpb] = await Promise.allSettled([this.yts(title, year), this.tpb(title + ' ' + year)])
      results.push(...(yts.value || []), ...(tpb.value || []))
    } else if (type === 'tv') {
      if (imdbId) {
        const ez = await this.eztv(imdbId, season, episode).catch(() => [])
        results.push(...ez)
      }
      const tpb = await this.tpb(`${title} S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`).catch(() => [])
      results.push(...tpb)
    } else {
      const ny = await this.nyaa(title).catch(() => [])
      results.push(...ny)
      const tpb = await this.tpb(title + ' anime').catch(() => [])
      results.push(...tpb)
    }

    return results
  }
}
