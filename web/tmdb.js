const TMDB_IMG  = 'https://image.tmdb.org/t/p'
const TMDB_BASE = 'https://api.themoviedb.org/3'

window.TMDB = {
  poster:   (p, size = 'w500')  => p ? `${TMDB_IMG}/${size}${p}` : 'no-poster.svg',
  backdrop: (p, size = 'w1280') => p ? `${TMDB_IMG}/${size}${p}` : null,
  title:    (item) => item.title || item.name || '?',
  year:     (item) => (item.release_date || item.first_air_date || '').slice(0, 4),
  type:     (item) => item.media_type || (item.first_air_date !== undefined ? 'tv' : 'movie'),
  imdbId:   (d)   => d.external_ids?.imdb_id || null,

  async _get(path, params = {}) {
    const url = new URL('/api/tmdb', location.origin)
    url.searchParams.set('path', path)
    url.searchParams.set('language', 'fr-FR')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const r = await fetch(url)
    if (!r.ok) throw new Error(`TMDB ${r.status}`)
    return r.json()
  },

  trending(type = 'all')        { return this._get(`/trending/${type}/week`) },
  popular(type = 'movie')       { return this._get(`/${type}/popular`) },
  topRated(type = 'movie')      { return this._get(`/${type}/top_rated`) },
  search(query, type = 'multi') { return this._get(`/search/${type}`, { query, include_adult: false }) },
  details(id, type = 'movie')   { return this._get(`/${type}/${id}`, { append_to_response: 'credits,videos,external_ids' }) },
  season(tvId, n)               { return this._get(`/tv/${tvId}/season/${n}`) },
  anime(page = 1) {
    return this._get('/discover/tv', { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc', page })
  },
  animeMovies(page = 1) {
    return this._get('/discover/movie', { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc', page })
  }
}
