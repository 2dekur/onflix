const app = (() => {
  let state = {
    currentItem: null,
    currentDetails: null,
    currentSeason: 1,
    heroItem: null,
    client: null,
    activeTorrent: null,
    searchTimer: null,
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function getSetting(k) { return localStorage.getItem(k) || '' }
  function setSetting(k, v) { localStorage.setItem(k, v) }

  function toast(msg, dur = 3000) {
    const el = document.getElementById('toast')
    el.textContent = msg
    el.classList.add('show')
    setTimeout(() => el.classList.remove('show'), dur)
  }

  function noPoster() { return 'no-poster.svg' }

  function safeImg(img) {
    img.onerror = () => { img.onerror = null; img.src = noPoster() }
  }

  // ── init ─────────────────────────────────────────────────────────────────

  async function init() {
    showHome()
    loadHome()
    bindNav()
    bindSearch()
    document.getElementById('btn-settings').onclick = openSettings
  }

  function showHome() {
    document.getElementById('onboarding').style.display = 'none'
    document.getElementById('home-page').classList.remove('hidden')
    document.getElementById('navbar').style.display = ''
  }

  function bindNav() {
    document.querySelectorAll('.nav-links button').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const page = btn.dataset.page
        document.getElementById('search-page').classList.add('hidden')
        document.getElementById('home-page').classList.remove('hidden')
        if (page === 'home') loadHome()
        else if (page === 'movies') loadPage('movies')
        else if (page === 'series') loadPage('series')
        else if (page === 'anime') loadPage('anime')
      }
    })
  }

  function bindSearch() {
    const inp = document.getElementById('search-input')
    inp.addEventListener('input', () => {
      clearTimeout(state.searchTimer)
      const q = inp.value.trim()
      if (!q) {
        document.getElementById('search-page').classList.add('hidden')
        document.getElementById('home-page').classList.remove('hidden')
        return
      }
      state.searchTimer = setTimeout(() => doSearch(q), 400)
    })
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { inp.value = ''; inp.dispatchEvent(new Event('input')) }
    })
  }

  // ── home ─────────────────────────────────────────────────────────────────

  async function loadHome() {
    const sections = document.getElementById('sections')
    sections.innerHTML = ''
    const rows = [
      { title: 'Tendances', fn: () => TMDB.trending('all') },
      { title: 'Films populaires', fn: () => TMDB.popular('movie') },
      { title: 'Séries populaires', fn: () => TMDB.popular('tv') },
      { title: 'Animés', fn: () => TMDB.anime() },
      { title: 'Top Films', fn: () => TMDB.topRated('movie') },
      { title: 'Top Séries', fn: () => TMDB.topRated('tv') },
    ]
    rows.forEach(r => {
      const sec = document.createElement('div')
      sec.className = 'section'
      sec.innerHTML = `<div class="section-title">${r.title}</div><div class="cards-row" id="row-${r.title.replace(/\s/g,'')}"></div>`
      sections.appendChild(sec)
      loadRowAsync(sec.querySelector('.cards-row'), r.fn)
    })
    loadHero()
  }

  async function loadPage(type) {
    const sections = document.getElementById('sections')
    sections.innerHTML = ''
    let rows = []
    if (type === 'movies') rows = [
      { title: 'Films populaires', fn: () => TMDB.popular('movie') },
      { title: 'Top Films', fn: () => TMDB.topRated('movie') },
      { title: 'Tendances films', fn: () => TMDB.trending('movie') },
    ]
    else if (type === 'series') rows = [
      { title: 'Séries populaires', fn: () => TMDB.popular('tv') },
      { title: 'Top Séries', fn: () => TMDB.topRated('tv') },
      { title: 'Tendances séries', fn: () => TMDB.trending('tv') },
    ]
    else if (type === 'anime') rows = [
      { title: 'Animés populaires', fn: () => TMDB.anime() },
      { title: 'Films animés', fn: () => TMDB.animeMovies() },
    ]
    rows.forEach(r => {
      const sec = document.createElement('div')
      sec.className = 'section'
      sec.innerHTML = `<div class="section-title">${r.title}</div><div class="cards-row"></div>`
      sections.appendChild(sec)
      loadRowAsync(sec.querySelector('.cards-row'), r.fn)
    })
  }

  async function loadRowAsync(container, fetchFn) {
    const skels = Array.from({ length: 8 }, () => {
      const d = document.createElement('div')
      d.className = 'skel-card skeleton'
      container.appendChild(d)
      return d
    })
    try {
      const data = await fetchFn()
      const items = data.results || []
      skels.forEach(s => s.remove())
      items.forEach(item => {
        const div = document.createElement('div')
        div.className = 'card'
        div.innerHTML = `<img src="${TMDB.poster(item.poster_path)}" alt="${TMDB.title(item)}" loading="lazy"><div class="card-title">${TMDB.title(item)}</div>`
        safeImg(div.querySelector('img'))
        div.onclick = () => openDetails(item)
        container.appendChild(div)
      })
    } catch { skels.forEach(s => s.remove()) }
  }

  async function loadHero() {
    try {
      const data = await TMDB.trending('all')
      const item = (data.results || [])[0]
      if (!item) return
      state.heroItem = item
      const bd = TMDB.backdrop(item.backdrop_path)
      if (bd) document.getElementById('hero-img').src = bd
      document.getElementById('hero-title').textContent = TMDB.title(item)
      document.getElementById('hero-meta').textContent = `${TMDB.year(item)} · ${TMDB.type(item) === 'movie' ? 'Film' : 'Série'}`
      document.getElementById('hero-desc').textContent = item.overview || ''
    } catch {}
  }

  function playHero() {
    if (state.heroItem) openDetails(state.heroItem)
  }

  // ── search ───────────────────────────────────────────────────────────────

  async function doSearch(query) {
    document.getElementById('home-page').classList.add('hidden')
    document.getElementById('search-page').classList.remove('hidden')
    const grid = document.getElementById('search-grid')
    document.getElementById('search-heading').textContent = `"${query}"`
    grid.innerHTML = Array.from({ length: 10 }, () => `<div class="skel-card skeleton" style="aspect-ratio:2/3"></div>`).join('')
    try {
      const data = await TMDB.search(query)
      grid.innerHTML = ''
      const items = (data.results || []).filter(i => i.poster_path && (i.media_type === 'movie' || i.media_type === 'tv'))
      if (!items.length) { grid.innerHTML = '<p style="color:var(--text2)">Aucun résultat.</p>'; return }
      items.forEach(item => {
        const div = document.createElement('div')
        div.className = 'card'
        div.innerHTML = `<img src="${TMDB.poster(item.poster_path)}" alt="${TMDB.title(item)}" loading="lazy"><div class="card-title">${TMDB.title(item)}</div>`
        safeImg(div.querySelector('img'))
        div.onclick = () => openDetails(item)
        grid.appendChild(div)
      })
    } catch { grid.innerHTML = '<p style="color:var(--text2)">Erreur de recherche.</p>' }
  }

  // ── detail modal ─────────────────────────────────────────────────────────

  async function openDetails(item) {
    state.currentItem = item
    state.currentDetails = null
    const type = TMDB.type(item)
    document.getElementById('modal-bg').classList.add('open')
    document.getElementById('modal-seasons').style.display = 'none'
    document.getElementById('modal-title').textContent = TMDB.title(item)
    document.getElementById('modal-meta').textContent = TMDB.year(item)
    document.getElementById('modal-desc').textContent = item.overview || ''
    document.getElementById('modal-actions').innerHTML = '<span style="color:var(--text2);font-size:.85rem">Chargement…</span>'

    const poster = TMDB.poster(item.poster_path)
    const pi = document.getElementById('modal-poster')
    pi.src = poster; safeImg(pi)

    try {
      const d = await TMDB.details(item.id, type)
      state.currentDetails = d
      const bd = TMDB.backdrop(d.backdrop_path || item.backdrop_path)
      if (bd) { const bi = document.getElementById('modal-backdrop'); bi.src = bd; safeImg(bi) }

      const genres = (d.genres || []).map(g => g.name).join(', ')
      const rating = d.vote_average ? `⭐ ${d.vote_average.toFixed(1)}` : ''
      document.getElementById('modal-meta').textContent = [TMDB.year(item), genres, rating].filter(Boolean).join(' · ')
      document.getElementById('modal-desc').textContent = d.overview || item.overview || ''

      const actions = document.getElementById('modal-actions')
      if (type === 'tv' || type === 'anime') {
        actions.innerHTML = ''
        loadSeasons(d)
      } else {
        actions.innerHTML = `<button class="btn-play" onclick="app.showSources()"><svg width="13" height="13" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg> Regarder</button>`
      }
    } catch {
      document.getElementById('modal-actions').innerHTML = `<button class="btn-play" onclick="app.showSources()">Regarder</button>`
    }
  }

  function closeModal() {
    document.getElementById('modal-bg').classList.remove('open')
  }

  function loadSeasons(d) {
    const seasons = (d.seasons || []).filter(s => s.season_number > 0)
    if (!seasons.length) {
      document.getElementById('modal-actions').innerHTML = `<button class="btn-play" onclick="app.showSources(1,1)">Regarder</button>`
      return
    }
    const container = document.getElementById('modal-seasons')
    container.style.display = ''
    const sel = document.createElement('select')
    sel.className = 'season-select'
    seasons.forEach(s => {
      const opt = document.createElement('option')
      opt.value = s.season_number
      opt.textContent = `Saison ${s.season_number}`
      sel.appendChild(opt)
    })
    const epGrid = document.createElement('div')
    epGrid.className = 'episodes-grid'
    container.innerHTML = ''
    container.appendChild(sel)
    container.appendChild(epGrid)

    async function loadEps(seasonNum) {
      state.currentSeason = seasonNum
      epGrid.innerHTML = '<span style="color:var(--text2);font-size:.85rem">Chargement…</span>'
      try {
        const sd = await TMDB.season(d.id, seasonNum)
        epGrid.innerHTML = ''
        ;(sd.episodes || []).forEach(ep => {
          const div = document.createElement('div')
          div.className = 'ep-card'
          div.innerHTML = `<div class="ep-num">S${String(seasonNum).padStart(2,'0')}E${String(ep.episode_number).padStart(2,'0')}</div><div class="ep-name">${ep.name || 'Épisode ' + ep.episode_number}</div>`
          div.onclick = () => { closeModal(); showSources(seasonNum, ep.episode_number) }
          epGrid.appendChild(div)
        })
      } catch { epGrid.innerHTML = '<span style="color:var(--text2)">Erreur</span>' }
    }

    sel.onchange = () => loadEps(parseInt(sel.value))
    loadEps(seasons[0].season_number)
  }

  // ── source picker ────────────────────────────────────────────────────────

  async function showSources(season, episode) {
    const item = state.currentItem
    const details = state.currentDetails
    if (!item) return
    closeModal()

    document.getElementById('source-modal').classList.add('open')
    document.getElementById('source-title').textContent = TMDB.title(item)
    document.getElementById('source-sub').textContent = season ? `S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}` : 'Sélectionne la qualité'
    const list = document.getElementById('source-list')
    list.innerHTML = '<span style="color:var(--text2);font-size:.85rem;padding:8px">Recherche des sources…</span>'

    const type = TMDB.type(item)
    const imdbId = details ? TMDB.imdbId(details) : null

    // embed fallbacks first (always available)
    const embeds = Sources.embedUrls(imdbId, item.id, type === 'tv' ? 'tv' : 'movie', season, episode)

    // torrent search
    let torrents = []
    try { torrents = await Sources.getAllTorrent(item, details || {}, season, episode) } catch {}

    list.innerHTML = ''

    if (!torrents.length && !embeds.length) {
      list.innerHTML = '<span style="color:var(--text2);font-size:.85rem;padding:8px">Aucune source trouvée.</span>'
      return
    }

    torrents.forEach(t => {
      const div = document.createElement('div')
      div.className = 'source-item'
      const badge = t.fr
        ? `<div class="src-badge vf">VF 🇫🇷</div>`
        : `<div class="src-badge">${t.seeds ? t.seeds + ' seeds' : t.source.toUpperCase()}</div>`
      div.innerHTML = `${badge}<div class="src-info"><div class="src-name">${t.label}</div><div class="src-detail">${t.size || ''}${t.seeds ? ' · ' + t.seeds + ' seeds' : ''}</div></div>`
      div.onclick = () => { closeSourceModal(); startStream(t.magnet, TMDB.title(item)) }
      list.appendChild(div)
    })

    embeds.forEach(e => {
      const div = document.createElement('div')
      div.className = 'source-item'
      div.innerHTML = `<div class="src-badge embed">${e.label}</div><div class="src-info"><div class="src-name">${e.label}</div><div class="src-detail">Lecteur intégré</div></div>`
      div.onclick = () => { closeSourceModal(); startEmbed(e.url, TMDB.title(item)) }
      list.appendChild(div)
    })
  }

  function closeSourceModal() {
    document.getElementById('source-modal').classList.remove('open')
  }

  // ── player ───────────────────────────────────────────────────────────────

  function openPlayer(title) {
    document.getElementById('player-title').textContent = title
    document.getElementById('player-section').classList.add('open')
    document.getElementById('ps-text').textContent = 'Connexion…'
    document.getElementById('ps-bar').style.width = '0%'
    document.getElementById('ps-peers').textContent = ''
  }

  function closePlayer() {
    const vid = document.getElementById('video-player')
    const emb = document.getElementById('embed-player')
    vid.pause(); vid.src = ''; vid.style.display = ''
    emb.src = ''; emb.style.display = 'none'
    document.getElementById('player-section').classList.remove('open')
    if (state.activeTorrent) {
      state.activeTorrent.destroy()
      state.activeTorrent = null
    }
  }

  function startEmbed(url, title) {
    openPlayer(title)
    const vid = document.getElementById('video-player')
    const emb = document.getElementById('embed-player')
    vid.style.display = 'none'
    emb.style.display = ''
    emb.src = url
    document.getElementById('ps-text').textContent = 'Lecteur intégré'
    document.getElementById('ps-bar').style.width = '100%'
  }

  function startStream(magnet, title) {
    openPlayer(title)
    document.getElementById('ps-text').textContent = 'Connexion aux pairs…'

    if (!state.client) {
      state.client = new WebTorrent()
    }

    if (state.activeTorrent) {
      state.activeTorrent.destroy()
      state.activeTorrent = null
    }

    const vid = document.getElementById('video-player')
    vid.style.display = ''
    document.getElementById('embed-player').style.display = 'none'

    const torrent = state.client.add(magnet, { announce: [
      'wss://tracker.btorrent.xyz',
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.fastcast.nz'
    ]})
    state.activeTorrent = torrent

    torrent.on('error', err => {
      toast('Erreur torrent — essaie un embed')
      document.getElementById('ps-text').textContent = 'Erreur: ' + err.message
    })

    torrent.on('ready', () => {
      const file = torrent.files.reduce((a, b) => a.length > b.length ? a : b)
      file.renderTo(vid)
      document.getElementById('ps-text').textContent = 'Buffering…'
    })

    torrent.on('download', () => {
      const pct = Math.round(torrent.progress * 100)
      document.getElementById('ps-bar').style.width = pct + '%'
      document.getElementById('ps-text').textContent = `${pct}% · ${(torrent.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s`
      document.getElementById('ps-peers').textContent = `${torrent.numPeers} pairs`
    })

    torrent.on('done', () => {
      document.getElementById('ps-text').textContent = 'Téléchargé'
      document.getElementById('ps-bar').style.width = '100%'
    })

    setTimeout(() => {
      if (torrent.numPeers === 0 && !torrent.progress) {
        toast('Aucun pair trouvé — essaie un embed')
        document.getElementById('ps-text').textContent = 'Aucun pair — essaie un lecteur intégré'
      }
    }, 15000)
  }

  // ── settings ─────────────────────────────────────────────────────────────

  function openSettings() {
    document.getElementById('settings-modal').classList.add('open')
  }

  function closeSettings() {
    document.getElementById('settings-modal').classList.remove('open')
  }

  function saveSettings() {
    closeSettings()
    toast('Sauvegardé')
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return {
    init, playHero, openDetails, closeModal,
    showSources, closeSourceModal,
    closePlayer, startStream, startEmbed,
    openSettings, closeSettings, saveSettings,
    toggleFullscreen,
  }
})()

document.addEventListener('DOMContentLoaded', () => app.init())
