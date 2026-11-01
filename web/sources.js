window.Sources = {

  // ── TPB ───────────────────────────────────────────────────────────────────

  async tpb(query, cat = 0) {
    try {
      const r = await fetch(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=${cat}`)
      const j = await r.json()
      return (Array.isArray(j) ? j : [])
        .filter(t => parseInt(t.seeders) > 0)
        .map(t => ({
          label: t.name,
          magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce`,
          seeds: parseInt(t.seeders) || 0,
          size: _fmtSize(parseInt(t.size)),
          source: 'TPB',
          fr: _isFr(t.name),
        }))
    } catch { return [] }
  },

  // ── YTS ───────────────────────────────────────────────────────────────────

  async yts(title, year) {
    try {
      const r = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(title)}&limit=5`)
      const j = await r.json()
      const movies = j.data?.movies || []
      const match = movies.find(m => String(m.year) === String(year)) || movies[0]
      if (!match) return []
      return (match.torrents || [])
        .sort((a,b) => _qRank(b.quality) - _qRank(a.quality))
        .map(t => ({
          label: `[YTS] ${match.title} ${t.quality} ${t.type}`,
          magnet: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(match.title_long)}&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce`,
          size: t.size, seeds: t.seeds, source: 'YTS', fr: false,
        }))
    } catch { return [] }
  },

  // ── EZTV ──────────────────────────────────────────────────────────────────

  async eztv(imdbId, season, episode) {
    try {
      const r = await fetch(`https://eztv.re/api/get-torrents?imdb_id=${imdbId.replace('tt','')}&limit=20`)
      const j = await r.json()
      return (j.torrents || [])
        .filter(t => t.season == season && t.episode == episode && parseInt(t.seeds) > 0)
        .map(t => ({
          label: t.title, magnet: t.magnet_url,
          seeds: parseInt(t.seeds) || 0, source: 'EZTV', fr: _isFr(t.title),
        }))
    } catch { return [] }
  },

  // ── Nyaa proxy ────────────────────────────────────────────────────────────

  async nyaa(title) {
    try {
      const r = await fetch(`/api/nyaa?q=${encodeURIComponent(title + ' 1080p')}`)
      const doc = new DOMParser().parseFromString(await r.text(), 'text/xml')
      return [...doc.querySelectorAll('item')].slice(0,8).map(el => ({
        label: el.querySelector('title')?.textContent || 'Nyaa',
        magnet: el.querySelector('link')?.textContent || el.querySelector('enclosure')?.getAttribute('url') || '',
        source: 'Nyaa', fr: false,
      })).filter(t => t.magnet.startsWith('magnet:'))
    } catch { return [] }
  },

  // ── getAllTorrent ──────────────────────────────────────────────────────────

  async getAllTorrent(item, details, season, episode) {
    const type = TMDB.type(item)
    const title = TMDB.origTitle(item)
    const year  = TMDB.year(item)
    const imdbId = TMDB.imdbId(details)
    let results = []

    if (type === 'movie') {
      const q = `${title} ${year}`
      const all = await Promise.allSettled([
        this.yts(title, year),
        this.tpb(`${q} FRENCH`),
        this.tpb(`${q} VF`),
        this.tpb(`${q} TRUEFRENCH`),
        this.tpb(q),
      ])
      results = _merge(...all.map(r => r.value||[]))
    }
    else if (type === 'tv') {
      const ep = `S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`
      const q = `${title} ${ep}`
      const all = await Promise.allSettled([
        imdbId ? this.eztv(imdbId, season, episode) : Promise.resolve([]),
        this.tpb(`${q} FRENCH`),
        this.tpb(`${q} VF`),
        this.tpb(`${q} VOSTFR`),
        this.tpb(`${q} VFF`),
        this.tpb(q),
      ])
      results = _merge(...all.map(r => r.value||[]))
    }
    else {
      const all = await Promise.allSettled([
        this.tpb(`${title} FRENCH`),
        this.tpb(`${title} VOSTFR`),
        this.nyaa(title),
        this.tpb(`${title} anime`),
      ])
      results = _merge(...all.map(r => r.value||[]))
    }

    return results.sort((a,b) => (b.fr?1:0)-(a.fr?1:0) || _qRank(_parseQ(b.label))-_qRank(_parseQ(a.label)) || (b.seeds||0)-(a.seeds||0))
  },

  embedUrls(imdbId, tmdbId, type, season, episode) {
    if (!tmdbId) return []
    const s = season||1, e = episode||1
    const mv = type === 'movie'
    if (mv) return [
      { label: 'VOSTFR 1', url: `https://cinesrc.st/embed/movie/${tmdbId}` },
      { label: 'VOSTFR 2', url: `https://vidsrc.sbs/embed/movie/${tmdbId}` },
    ]
    return [
      { label: 'VOSTFR 1', url: `https://cinesrc.st/embed/tv/${tmdbId}?s=${s}&e=${e}` },
      { label: 'VOSTFR 2', url: `https://vidsrc.sbs/embed/tv/${tmdbId}/${s}/${e}` },
    ]
  },
}

// ── utils ──────────────────────────────────────────────────────────────────

function _isFr(name) {
  return /\b(FRENCH|VF|VFF|VOSTFR|VO STF|TRUEFRENCH|MULTi|MULTI)\b/i.test(name)
}

function _parseQ(name) {
  if (/2160p|4K/i.test(name)) return '4K'
  if (/1080p/i.test(name)) return '1080p'
  if (/720p/i.test(name)) return '720p'
  return ''
}

function _qRank(q) {
  return { '4K': 4, '1080p': 3, '720p': 2 }[q] || 0
}

function _fmtSize(bytes) {
  if (!bytes) return ''
  const gb = bytes/1024/1024/1024
  return gb >= 1 ? gb.toFixed(1)+' GB' : (bytes/1024/1024).toFixed(0)+' MB'
}

function _merge(...arrays) {
  const seen = new Set()
  return arrays.flatMap(a => a||[]).filter(t => {
    const key = t.magnet?.slice(0,60)
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}
