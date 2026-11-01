window.Sources = {

  // ── TPB (apibay.org — CORS open) ─────────────────────────────────────────

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
          source: 'tpb',
          fr: _isFr(t.name),
        }))
    } catch { return [] }
  },

  // ── YTS (movies, mostly English — kept for quality) ──────────────────────

  async yts(title, year) {
    try {
      const r = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(title)}&limit=5`)
      const j = await r.json()
      const movies = j.data?.movies || []
      const match = movies.find(m => String(m.year) === String(year)) || movies[0]
      if (!match) return []
      return (match.torrents || [])
        .sort((a, b) => (_qRank(b.quality) - _qRank(a.quality)))
        .map(t => ({
          label: `YTS · ${t.quality} ${t.type}`,
          magnet: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(match.title_long)}&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce`,
          size: t.size, seeds: t.seeds, source: 'yts', fr: false,
        }))
    } catch { return [] }
  },

  // ── EZTV (series English) ─────────────────────────────────────────────────

  async eztv(imdbId, season, episode) {
    try {
      const r = await fetch(`https://eztv.re/api/get-torrents?imdb_id=${imdbId.replace('tt','')}&limit=20`)
      const j = await r.json()
      return (j.torrents || [])
        .filter(t => t.season == season && t.episode == episode && parseInt(t.seeds) > 0)
        .map(t => ({
          label: t.title,
          magnet: t.magnet_url,
          seeds: parseInt(t.seeds) || 0,
          source: 'eztv', fr: _isFr(t.title),
        }))
    } catch { return [] }
  },

  // ── Nyaa proxy (anime) ────────────────────────────────────────────────────

  async nyaa(title) {
    try {
      const r = await fetch(`/api/nyaa?q=${encodeURIComponent(title + ' 1080p')}`)
      const text = await r.text()
      const doc = new DOMParser().parseFromString(text, 'text/xml')
      return [...doc.querySelectorAll('item')].slice(0, 8).map(el => ({
        label: el.querySelector('title')?.textContent || 'Nyaa',
        magnet: el.querySelector('link')?.textContent || el.querySelector('enclosure')?.getAttribute('url') || '',
        source: 'nyaa', fr: false,
      })).filter(t => t.magnet.startsWith('magnet:'))
    } catch { return [] }
  },

  // ── unified ───────────────────────────────────────────────────────────────

  async getAllTorrent(item, details, season, episode) {
    const type = TMDB.type(item)
    const title = TMDB.origTitle(item)
    const year  = TMDB.year(item)
    const imdbId = TMDB.imdbId(details)
    let results = []

    if (type === 'movie') {
      const s = `${title} ${year}`
      const [yts, tpbFr, tpbVf, tpbEn] = await Promise.allSettled([
        this.yts(title, year),
        this.tpb(`${s} FRENCH`),
        this.tpb(`${s} VF`),
        this.tpb(s),
      ])
      results = _merge(yts.value, tpbFr.value, tpbVf.value, tpbEn.value)
    }
    else if (type === 'tv') {
      const ep = `S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`
      const s = `${title} ${ep}`
      const searches = [
        imdbId ? this.eztv(imdbId, season, episode) : Promise.resolve([]),
        this.tpb(`${s} FRENCH`),
        this.tpb(`${s} VF`),
        this.tpb(`${s} VFF`),
        this.tpb(s),
      ]
      const all = await Promise.allSettled(searches)
      results = _merge(...all.map(r => r.value))
    }
    else {
      // anime
      const [ny, tpbFr, tpb] = await Promise.allSettled([
        this.nyaa(title),
        this.tpb(`${title} FRENCH`),
        this.tpb(`${title} anime`),
      ])
      results = _merge(tpbFr.value, ny.value, tpb.value)
    }

    // French results first, then by seeds
    return results
      .sort((a, b) => (b.fr ? 1 : 0) - (a.fr ? 1 : 0) || (b.seeds || 0) - (a.seeds || 0))
  },

  // ── embed fallbacks ───────────────────────────────────────────────────────

  embedUrls(imdbId, tmdbId, type, season, episode) {
    const s = season || 1, e = episode || 1
    const urls = []
    const isMovie = type === 'movie'
    if (tmdbId) {
      if (isMovie) {
        urls.push({ label: 'VidSrc',      url: `https://vidsrc.to/embed/movie/${tmdbId}` })
        urls.push({ label: 'VidSrc 2',    url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}` })
        urls.push({ label: 'EmbedSu',     url: `https://embed.su/embed/movie/${tmdbId}` })
        urls.push({ label: 'MoviesAPI',   url: `https://moviesapi.club/movie/${tmdbId}` })
        urls.push({ label: 'AutoEmbed',   url: `https://autoembed.co/movie/tmdb/${tmdbId}` })
        urls.push({ label: 'MultiEmbed',  url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` })
      } else {
        urls.push({ label: 'VidSrc',      url: `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}` })
        urls.push({ label: 'VidSrc 2',    url: `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` })
        urls.push({ label: 'EmbedSu',     url: `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` })
        urls.push({ label: 'MoviesAPI',   url: `https://moviesapi.club/tv/${tmdbId}-${s}-${e}` })
        urls.push({ label: 'AutoEmbed',   url: `https://autoembed.co/tv/tmdb/${tmdbId}-${s}-${e}` })
        urls.push({ label: 'MultiEmbed',  url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}` })
      }
    }
    if (imdbId) {
      if (isMovie) {
        urls.push({ label: '2Embed',      url: `https://www.2embed.cc/embed/${imdbId}` })
      } else {
        urls.push({ label: '2Embed',      url: `https://www.2embed.cc/embedtv/${imdbId}&s=${s}&e=${e}` })
      }
    }
    return urls
  },
}

// ── utils ─────────────────────────────────────────────────────────────────

function _isFr(name) {
  return /\b(FRENCH|VF|VFF|VOSTFR|VO STF|TRUEFRENCH|MULTi|MULTI)\b/i.test(name)
}

function _qRank(q) {
  return { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 }[q] || 0
}

function _fmtSize(bytes) {
  if (!bytes) return ''
  const gb = bytes / 1024 / 1024 / 1024
  return gb >= 1 ? gb.toFixed(1) + ' GB' : (bytes / 1024 / 1024).toFixed(0) + ' MB'
}

function _merge(...arrays) {
  const seen = new Set()
  return (arrays || []).flatMap(a => a || []).filter(t => {
    const key = t.magnet?.slice(0, 60)
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}
