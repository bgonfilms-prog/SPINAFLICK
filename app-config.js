// Change this before publishing. Both people use the same access code.
// This is a privacy gate for a static site, not a substitute for server-side authentication.
export const appConfig = {
  accessCode: 'movie-night',
  appName: 'Reel Roulette',
  // Movie autocomplete is routed through /api/movies so no TMDB credential is shipped to browsers.
};
