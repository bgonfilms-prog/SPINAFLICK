const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = String(req.query?.query || '').trim();
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: 'Enter between 2 and 100 characters.' });
  }

  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'Movie search is not configured.' });
  }

  try {
    const url = new URL(TMDB_SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('page', '1');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error('TMDB request failed:', response.status);
      return res.status(502).json({ error: 'Movie provider request failed.' });
    }

    const data = await response.json();
    const results = (data.results || []).slice(0, 10).map((movie) => ({
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      release_date: movie.release_date || '',
      poster_path: movie.poster_path || null,
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ results });
  } catch (error) {
    console.error('Movie search error:', error);
    return res.status(500).json({ error: 'Movie search is temporarily unavailable.' });
  }
};
