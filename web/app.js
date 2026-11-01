const app = (() => {
  const $ = id => document.getElementById(id)

  const state = {
    heroItem: null,
    currentItem: null,
    currentDetails: null,
    currentSeason: 1,
    client: null,
    activeTorrent: null,
    plyr: null,
    searchTimer: null,
  }

  // ── utils ──────────────────────────────────────────────────────────────────

  function toast(msg, dur = 3500) {
    const el = $('toast')
    el.textContent = msg
    el.classList.add('show')
    setTimeout(() => el.classList.remove('show'), dur)
  }

  function safeImg(img, fallback = 'no-poster.svg') {
    img.onerror = () => { img.onerror = null; img.src = fallback }
  }

  // ── init ───────────────────────────────────────────────────────────────────

  function init() {
    $('page-home').classList.remove('hidden')
    loadHome()
    bindNav()
    bindSearch()
  }

  function bindNav() {
    document.querySelectorAll('.nav-links button').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        $('page-search').classList.add('hidden')
        $('page-home').classList.remove('hidden')
        const pg = btn.dataset.page
        if (pg === 'home') loadHome()
        else loadCatalog(pg)
      }
    })
  }

  function bindSearch() {
    const inp = $('search-input')
    inp.addEventListener('input', () => {
      clearTimeout(state.searchTimer)
      const q = inp.value.trim()
      if (!q) { $('page-search').classList.add('hidden'); $('page-home').classList.remove('hidden'); return }
      state.searchTimer = setTimeout(() => search(q), 350)
    })
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') { inp.value = ''; inp.dispatchEvent(new Event('input')) } })
  }

  // ── home ───────────────────────────────────────────────────────────────────

  async function loadHome() {
    const rows = document.getElementById('rows')
    rows.innerHTML = ''
    const defs = [
      { title: 'Tendances', fn: () => TMDB.trending('all') },
      { title: 'Films populaires', fn: () => TMDB.popular('movie') },
      { title: 'Séries populaires', fn: () => TMDB.popular('tv') },
      { title: 'Animés', fn: () => TMDB.anime() },
      { title: 'Top Films', fn: () => TMDB.topRated('movie') },
      { title: 'Top Séries', fn: () => TMDB.topRated('tv') },
    ]
    defs.forEach(d => {
      const row = document.createElement('div')
      row.className = 'row'
      row.innerHTML = `<div class="row-title">${d.title}</div><div class="row-cards"></div>`
      rows.appendChild(row)
      fillRow(row.querySelector('.row-cards'), d.fn)
    })
    loadHero()
  }

  async function loadCatalog(type) {
    const rows = document.getElementById('rows')
    rows.innerHTML = ''
    let defs = []
    if (type === 'movies') defs = [
      { title: 'Films populaires', fn: () => TMDB.popular('movie') },
      { title: 'Top Films', fn: () => TMDB.topRated('movie') },
      { title: 'Tendances films', fn: () => TMDB.trending('movie') },
    ]
    else if (type === 'series') defs = [
      { title: 'Séries populaires', fn: () => TMDB.popular('tv') },
      { title: 'Top Séries', fn: () => TMDB.topRated('tv') },
      { title: 'Tendances séries', fn: () => TMDB.trending('tv') },
    ]
    else if (type === 'anime') defs = [
      { title: 'Animés populaires', fn: () => TMDB.anime() },
      { title: 'Films animés', fn: () => TMDB.animeMovies() },
    ]
    defs.forEach(d => {
      const row = document.createElement('div')
      row.className = 'row'
      row.innerHTML = `<div class="row-title">${d.title}</div><div class="row-cards"></div>`
      rows.appendChild(row)
      fillRow(row.querySelector('.row-cards'), d.fn)
    })
  }

  async function fillRow(container, fetchFn) {
    const skels = Array.from({ length: 8 }, () => {
      const s = document.createElement('div'); s.className = 'skel'; container.appendChild(s); return s
    })
    try {
      const data = await fetchFn()
      skels.forEach(s => s.remove())
      ;(data.results || []).forEach(item => container.appendChild(makeCard(item)))
    } catch { skels.forEach(s => s.remove()) }
  }

  function makeCard(item) {
    const div = document.createElement('div')
    div.className = 'card'
    const img = document.createElement('img')
    img.src = TMDB.poster(item.poster_path)
    img.alt = TMDB.title(item)
    img.loading = 'lazy'
    safeImg(img)
    const title = document.createElement('div')
    title.className = 'card-title'
    title.textContent = TMDB.title(item)
    div.appendChild(img)
    div.appendChild(title)
    div.onclick = () => openDetail(item)
    return div
  }

  async function loadHero() {
    try {
      const data = await TMDB.trending('all')
      const item = (data.results || [])[Math.floor(Math.random() * 5)]
      if (!item) return
      state.heroItem = item
      const bd = TMDB.backdrop(item.backdrop_path)
      if (bd) $('hero-img').src = bd
      $('hero-title').textContent = TMDB.title(item)
      $('hero-desc').textContent = item.overview || ''
    } catch {}
  }

  function playHero() { if (state.heroItem) openDetail(state.heroItem) }
  function playHeroInfo() { if (state.heroItem) openDetail(state.heroItem) }

  // ── search ─────────────────────────────────────────────────────────────────

  async function search(query) {
    $('page-home').classList.add('hidden')
    $('page-search').classList.remove('hidden')
    const grid = $('search-grid')
    $('search-heading').innerHTML = `Résultats pour <em>"${query}"</em>`
    grid.innerHTML = Array.from({length:10},()=>`<div class="skel" style="aspect-ratio:2/3;flex:none;width:100%"></div>`).join('')
    try {
      const data = await TMDB.search(query)
      grid.innerHTML = ''
      const items = (data.results||[]).filter(i => i.poster_path && (i.media_type==='movie'||i.media_type==='tv'))
      if (!items.length) { grid.innerHTML = '<p style="color:var(--text2);grid-column:1/-1">Aucun résultat.</p>'; return }
      items.forEach(item => grid.appendChild(makeCard(item)))
    } catch { grid.innerHTML = '<p style="color:var(--text2);grid-column:1/-1">Erreur de recherche.</p>' }
  }

  // ── detail modal ───────────────────────────────────────────────────────────

  async function openDetail(item) {
    state.currentItem = item
    state.currentDetails = null
    const type = TMDB.type(item)
    $('d-title').textContent = TMDB.title(item)
    $('d-meta').innerHTML = `<span class="meta-tag">${TMDB.year(item)}</span><span class="meta-tag">${type === 'movie' ? 'Film' : 'Série'}</span>`
    $('d-desc').textContent = item.overview || ''
    $('d-actions').innerHTML = '<span style="color:var(--text2);font-size:.85rem">Chargement…</span>'
    $('d-seasons').innerHTML = ''

    const poster = TMDB.poster(item.poster_path)
    const pi = $('d-poster'); pi.src = poster; safeImg(pi)
    $('d-backdrop').src = TMDB.backdrop(item.backdrop_path) || ''

    $('modal-detail').classList.add('open')

    try {
      const d = await TMDB.details(item.id, type)
      state.currentDetails = d

      if (d.backdrop_path) $('d-backdrop').src = TMDB.backdrop(d.backdrop_path)

      const genres = (d.genres||[]).map(g=>`<span class="meta-tag">${g.name}</span>`).join('')
      const rat = d.vote_average ? `<span class="meta-tag rating">⭐ ${d.vote_average.toFixed(1)}</span>` : ''
      const yr = `<span class="meta-tag">${TMDB.year(item)}</span>`
      const tp = `<span class="meta-tag">${type === 'movie' ? 'Film' : 'Série'}</span>`
      $('d-meta').innerHTML = yr + tp + genres + rat
      $('d-desc').textContent = d.overview || item.overview || ''

      if (type === 'tv' || type === 'anime') {
        $('d-actions').innerHTML = ''
        buildSeasons(d)
      } else {
        $('d-actions').innerHTML = `<button class="btn-primary" onclick="app.showSources()"><svg width="13" height="13" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg> Regarder</button>`
      }
    } catch {
      $('d-actions').innerHTML = `<button class="btn-primary" onclick="app.showSources()">Regarder</button>`
    }
  }

  function closeDetail() { $('modal-detail').classList.remove('open') }

  function buildSeasons(d) {
    const seasons = (d.seasons||[]).filter(s => s.season_number > 0)
    if (!seasons.length) {
      $('d-actions').innerHTML = `<button class="btn-primary" onclick="app.showSources(1,1)">Regarder</button>`
      return
    }
    const wrap = $('d-seasons')
    const sel = document.createElement('select')
    sel.className = 'season-select'
    seasons.forEach(s => { const o = document.createElement('option'); o.value = s.season_number; o.textContent = `Saison ${s.season_number}`; sel.appendChild(o) })
    const epGrid = document.createElement('div')
    epGrid.className = 'ep-grid'
    wrap.appendChild(sel)
    wrap.appendChild(epGrid)

    async function loadEps(n) {
      state.currentSeason = n
      epGrid.innerHTML = '<span style="color:var(--text2);font-size:.85rem;padding:8px 0;display:block">Chargement…</span>'
      try {
        const sd = await TMDB.season(d.id, n)
        epGrid.innerHTML = ''
        ;(sd.episodes||[]).forEach(ep => {
          const div = document.createElement('div')
          div.className = 'ep-card'
          div.innerHTML = `<div class="ep-num">S${String(n).padStart(2,'0')}E${String(ep.episode_number).padStart(2,'0')}</div><div class="ep-name">${ep.name||'Épisode '+ep.episode_number}</div>`
          div.onclick = () => { closeDetail(); showSources(n, ep.episode_number) }
          epGrid.appendChild(div)
        })
      } catch { epGrid.innerHTML = '<span style="color:var(--text2);font-size:.85rem">Erreur</span>' }
    }

    sel.onchange = () => loadEps(parseInt(sel.value))
    loadEps(seasons[0].season_number)
  }

  // ── source picker ──────────────────────────────────────────────────────────

  async function showSources(season, episode) {
    const item = state.currentItem
    if (!item) return
    closeDetail()

    $('src-title').textContent = TMDB.title(item)
    $('src-sub').textContent = season ? `S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}` : ''
    $('src-list').innerHTML = `<div class="src-loading"><div class="src-spinner"></div>Recherche des sources…</div>`
    $('modal-source').classList.add('open')

    const type = TMDB.type(item)
    const details = state.currentDetails || {}
    const imdbId = TMDB.imdbId(details)
    const tmdbId = item.id

    const [allTorrents, embeds] = await Promise.all([
      Sources.getAllTorrent(item, details, season, episode).catch(() => []),
      Promise.resolve(Sources.embedUrls(imdbId, tmdbId, type === 'tv' ? 'tv' : 'movie', season, episode)),
    ])
    const torrents = allTorrents.filter(t => t.fr)

    $('src-list').innerHTML = ''

    const _hdr = (text) => {
      const d = document.createElement('div')
      d.style.cssText = 'font-size:.72rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text2);padding:10px 10px 4px'
      d.textContent = text
      return d
    }

    if (torrents.length) {
      $('src-list').appendChild(_hdr(`🇫🇷 Torrents VF (${torrents.length})`))
      torrents.forEach(t => $('src-list').appendChild(makeSrcItem(t, () => { closeSource(); startStream(t.magnet, TMDB.title(item)) })))
    }

    if (embeds.length) {
      $('src-list').appendChild(_hdr(`Lecteurs VOSTFR`))
      embeds.forEach(e => $('src-list').appendChild(makeEmbedItem(e, () => { closeSource(); startEmbed(e.url, TMDB.title(item)) })))
    }

    if (!torrents.length && !embeds.length) {
      $('src-list').innerHTML = `<div class="src-loading">
        <div style="font-size:2rem;margin-bottom:8px">🇫🇷</div>
        <div style="font-weight:600;margin-bottom:4px">Aucune source trouvée</div>
        <div style="font-size:.8rem;color:var(--text2)">Pas de torrent VF ni lecteur disponible pour ce titre</div>
      </div>`
    }
  }

  function makeSrcItem(t, onclick) {
    const div = document.createElement('div')
    div.className = 'src-item'
    const lang = t.fr ? (t.label.match(/VOSTFR/i) ? 'vostfr' : 'vf') : 'vo'
    const langBadge = lang === 'vf' ? '<span class="badge vf">VF 🇫🇷</span>'
                    : lang === 'vostfr' ? '<span class="badge vostfr">VOSTFR</span>'
                    : '<span class="badge vo">VO</span>'
    const q = _quality(t.label)
    const qBadge = q === '4K' ? '<span class="badge q4k">4K</span>'
                 : q === '1080p' ? '<span class="badge q1080">1080p</span>'
                 : q === '720p' ? '<span class="badge q720">720p</span>' : ''
    div.innerHTML = `
      <div class="src-badges">${langBadge}${qBadge}</div>
      <div class="src-info">
        <div class="src-name">${t.label}</div>
        <div class="src-detail">${[t.size, t.seeds ? t.seeds+' seeds' : '', t.source?.toUpperCase()].filter(Boolean).join(' · ')}</div>
      </div>`
    div.onclick = onclick
    return div
  }

  function makeEmbedItem(e, onclick) {
    const div = document.createElement('div')
    div.className = 'src-item'
    div.innerHTML = `
      <div class="src-badges"><span class="badge embed">${e.label}</span></div>
      <div class="src-info">
        <div class="src-name">${e.label}</div>
        <div class="src-detail">Lecteur intégré · audio variable</div>
      </div>`
    div.onclick = onclick
    return div
  }

  function closeSource() { $('modal-source').classList.remove('open') }

  // ── player ─────────────────────────────────────────────────────────────────

  function _plyr() {
    if (state.plyr) return state.plyr
    state.plyr = new Plyr($('vid'), {
      controls: ['play-large','play','rewind','fast-forward','progress','current-time','duration','mute','volume','captions','settings','fullscreen'],
      settings: ['captions','quality','speed'],
      captions: { active: true, language: 'fr', update: true },
      i18n: { play:'Lecture', pause:'Pause', mute:'Muet', settings:'Paramètres', fullscreen:'Plein écran' },
    })
    return state.plyr
  }

  function openPlayer(title) {
    $('player-title').textContent = title
    $('player').classList.add('open')
    $('dl-fill').style.width = '0'
    $('dl-text').textContent = 'Connexion…'
    $('dl-peers').textContent = ''
  }

  function closePlayer() {
    if (state.plyr) { state.plyr.pause() }
    else { const v = $('vid'); v.pause(); v.src = '' }
    $('emb').src = ''; $('emb').style.display = 'none'
    $('vid').style.display = ''
    $('player').classList.remove('open')
    if (state.activeTorrent) { state.activeTorrent.destroy(); state.activeTorrent = null }
  }

  function startEmbed(url, title) {
    openPlayer(title)
    $('vid').style.display = 'none'
    const emb = $('emb')
    emb.style.display = 'block'
    emb.src = url
    $('dl-text').textContent = 'Lecteur intégré'
    $('dl-fill').style.width = '100%'
  }

  async function startStream(magnet, title) {
    openPlayer(title)
    $('dl-text').textContent = 'Connexion aux pairs…'
    $('vid').style.display = ''
    $('emb').style.display = 'none'

    if (!state.client) state.client = new WebTorrent()
    if (state.activeTorrent) { state.activeTorrent.destroy(); state.activeTorrent = null }

    const player = _plyr()
    const torrent = state.client.add(magnet, { announce: [
      'wss://tracker.btorrent.xyz',
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.fastcast.nz',
    ]})
    state.activeTorrent = torrent

    torrent.on('error', err => {
      $('dl-text').textContent = 'Erreur — essaie un lecteur intégré'
      toast('Erreur torrent')
    })

    torrent.on('ready', () => {
      const file = torrent.files.reduce((a,b) => a.length > b.length ? a : b)
      file.renderTo($('vid'))
      $('dl-text').textContent = 'Buffering…'
      _loadSubs(player)
    })

    torrent.on('download', () => {
      const pct = Math.round(torrent.progress * 100)
      $('dl-fill').style.width = pct + '%'
      $('dl-text').textContent = `${pct}% · ${(torrent.downloadSpeed/1024/1024).toFixed(1)} MB/s`
      $('dl-peers').textContent = `${torrent.numPeers} pairs`
    })

    torrent.on('done', () => { $('dl-text').textContent = 'Téléchargé ✓'; $('dl-fill').style.width = '100%' })

    setTimeout(() => {
      if (!torrent.numPeers && !torrent.progress) {
        $('dl-text').textContent = 'Aucun pair — essaie un lecteur intégré'
        toast('Aucun pair trouvé')
      }
    }, 15000)
  }

  async function _loadSubs(player) {
    const details = state.currentDetails
    const imdbId = details ? TMDB.imdbId(details) : null
    if (!imdbId) return
    try {
      const r = await fetch(`/api/subtitles?imdb=${imdbId}&lang=fre`)
      const subs = await r.json()
      if (!Array.isArray(subs) || !subs.length) return
      const best = subs.sort((a,b) => (parseInt(b.SubDownloadsCnt)||0)-(parseInt(a.SubDownloadsCnt)||0))[0]
      if (!best?.SubDownloadLink) return
      const srtR = await fetch(`/api/subtitles?imdb=${imdbId}&lang=fre&url=${encodeURIComponent(best.SubDownloadLink)}`)
      const vtt = 'WEBVTT\n\n' + (await srtR.text()).replace(/\r/g,'').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2')
      const blob = new Blob([vtt], { type: 'text/vtt' })
      const track = document.createElement('track')
      track.kind = 'captions'; track.label = 'Français'; track.srclang = 'fr'
      track.src = URL.createObjectURL(blob); track.default = true
      $('vid').appendChild(track)
      player.currentTrack = 0
    } catch {}
  }

  function toggleFS() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  function _quality(name) {
    if (/2160p|4K/i.test(name)) return '4K'
    if (/1080p/i.test(name)) return '1080p'
    if (/720p/i.test(name)) return '720p'
    return ''
  }

  return {
    init, playHero, playHeroInfo,
    openDetail, closeDetail,
    showSources, closeSource,
    closePlayer, toggleFS,
  }
})()

document.addEventListener('DOMContentLoaded', () => app.init())
