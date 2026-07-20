import { firebaseConfig } from './firebase-config.js';
import { appConfig } from './app-config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('wheel');
const ctx = canvas.getContext('2d');

const state = {
  movies: [],
  history: [],
  filter: 'all',
  rotation: 0,
  spinning: false,
  selected: null,
  room: null,
  firestore: null,
  unsubscribe: null,
};

const palette = ['#8f7cff','#ff7189','#54d6c7','#ffcf5c','#72a7ff','#ff9b61','#9bdc68','#d98cff'];
const STORAGE_KEY = 'movie-night-wheel-v1';
const UNLOCK_KEY = 'reel-roulette-unlocked-v1';


function unlockApp() {
  document.body.classList.remove('locked');
  $('lockScreen').classList.add('hidden');
  $('passwordInput').value = '';
  $('lockError').textContent = '';
}

function lockApp() {
  sessionStorage.removeItem(UNLOCK_KEY);
  localStorage.removeItem(UNLOCK_KEY);
  document.body.classList.add('locked');
  $('lockScreen').classList.remove('hidden');
  $('passwordInput').focus();
}

function initializeAccessGate() {
  const remembered = localStorage.getItem(UNLOCK_KEY) === appConfig.accessCode;
  const sessionUnlocked = sessionStorage.getItem(UNLOCK_KEY) === appConfig.accessCode;
  if (remembered || sessionUnlocked) unlockApp();
  else setTimeout(() => $('passwordInput').focus(), 50);
}

function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadLocal() {
  const params = new URLSearchParams(location.search);
  const snapshot = params.get('list');
  if (snapshot) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(snapshot))));
      if (Array.isArray(decoded.movies)) state.movies = decoded.movies;
      if (Array.isArray(decoded.history)) state.history = decoded.history;
      saveLocal();
      history.replaceState({}, '', location.pathname + (params.get('room') ? `?room=${params.get('room')}` : ''));
    } catch (err) {
      console.warn('Could not load shared snapshot', err);
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && !snapshot) {
    try {
      const parsed = JSON.parse(saved);
      state.movies = parsed.movies || [];
      state.history = parsed.history || [];
    } catch {}
  }

  if (!state.movies.length) {
    state.movies = [
      { id: uid(), title: 'Interstellar', owner: 'Me', genre: 'Sci-Fi', watched: false },
      { id: uid(), title: 'Knives Out', owner: 'Partner', genre: 'Mystery', watched: false },
      { id: uid(), title: 'The Princess Bride', owner: 'Me', genre: 'Romance', watched: false },
      { id: uid(), title: 'Spider-Man: Into the Spider-Verse', owner: 'Partner', genre: 'Animation', watched: false },
    ];
    saveLocal();
  }
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ movies: state.movies, history: state.history }));
}

async function syncState() {
  saveLocal();
  if (state.firestore && state.room) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
    await setDoc(doc(state.firestore, 'rooms', state.room), {
      movies: state.movies,
      history: state.history,
      updatedAt: Date.now(),
    }, { merge: true });
  }
}

function eligibleMovies() {
  return state.movies.filter((m) => !m.watched);
}

function drawWheel() {
  const movies = eligibleMovies();
  const size = canvas.width;
  const center = size / 2;
  ctx.clearRect(0, 0, size, size);

  if (!movies.length) {
    ctx.beginPath();
    ctx.arc(center, center, center - 12, 0, Math.PI * 2);
    ctx.fillStyle = '#222945';
    ctx.fill();
    ctx.fillStyle = '#aeb6d3';
    ctx.font = '700 34px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Add an unwatched movie', center, center);
    $('spinBtn').disabled = true;
    return;
  }

  $('spinBtn').disabled = state.spinning;
  const slice = (Math.PI * 2) / movies.length;
  movies.forEach((movie, i) => {
    const start = state.rotation + i * slice - Math.PI / 2;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, center - 12, start, end);
    ctx.closePath();
    ctx.fillStyle = palette[i % palette.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.32)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#101427';
    ctx.font = `800 ${movies.length > 10 ? 20 : movies.length > 6 ? 25 : 31}px system-ui`;
    const title = movie.title.length > 25 ? `${movie.title.slice(0, 23)}…` : movie.title;
    ctx.fillText(title, center - 42, 10);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center, center, center * .2, 0, Math.PI * 2);
  ctx.fillStyle = '#12162a';
  ctx.fill();
}

function render() {
  drawWheel();
  $('movieCount').textContent = `${state.movies.length} total`;
  $('availableStat').textContent = eligibleMovies().length;
  $('watchedStat').textContent = state.history.length;

  let movies = [...state.movies];
  if (state.filter === 'unwatched') movies = movies.filter((m) => !m.watched);
  if (state.filter === 'mine') movies = movies.filter((m) => m.owner === 'Me');
  if (state.filter === 'partner') movies = movies.filter((m) => m.owner === 'Partner');

  $('movieList').innerHTML = movies.length ? movies.map((movie) => `
    <article class="movie-item ${movie.watched ? 'watched' : ''}">
      <div class="movie-leading">
        <span class="movie-number">${String(movies.indexOf(movie)+1).padStart(2,'0')}</span>
        <div class="movie-meta">
        <strong>${escapeHtml(movie.title)}</strong>
        <small>${escapeHtml(movie.owner)} · ${escapeHtml(movie.genre || 'Any')}${movie.watched ? ' · Watched' : ''}</small>
        </div>
      </div>
      <div class="item-actions">
        <button class="mini-button" data-action="toggle" data-id="${movie.id}" aria-label="Toggle watched">${movie.watched ? '↩' : '✓'}</button>
        <button class="mini-button" data-action="delete" data-id="${movie.id}" aria-label="Delete">×</button>
      </div>
    </article>`).join('') : '<div class="empty-state">No movies in this view.</div>';

  $('historyList').className = state.history.length ? 'history-list' : 'history-list empty-state';
  $('historyList').innerHTML = state.history.length ? state.history.map((item) => `
    <article class="history-item">
      <div><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.watchedAt).toLocaleDateString()}</small></div>
      <small>${escapeHtml(item.owner)}</small>
    </article>`).join('') : 'No movies watched yet.';
}


function parseBulkTitles(value = '') {
  const seen = new Set();
  return value
    .split(/[\n,;]+/)
    .map((title) => title.trim().replace(/^[-•*]\s*/, ''))
    .filter((title) => {
      if (!title) return false;
      const key = title.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 250);
}

function switchAddMode(mode) {
  
$('unlockForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const entered = $('passwordInput').value;
  if (entered !== appConfig.accessCode) {
    $('lockError').textContent = 'That access code is not correct.';
    $('passwordInput').select();
    return;
  }
  if ($('rememberDevice').checked) localStorage.setItem(UNLOCK_KEY, appConfig.accessCode);
  else sessionStorage.setItem(UNLOCK_KEY, appConfig.accessCode);
  unlockApp();
});

$('showPasswordBtn').addEventListener('click', () => {
  const input = $('passwordInput');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('showPasswordBtn').textContent = showing ? 'Show' : 'Hide';
  input.focus();
});

$('lockBtn').addEventListener('click', lockApp);

document.querySelectorAll('.add-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.addMode === mode));
  document.querySelectorAll('.add-pane').forEach((pane) => pane.classList.toggle('hidden', pane.dataset.pane !== mode));
  if (mode === 'bulk') $('bulkInput').focus();
  else $('titleInput').focus();
}

function escapeHtml(value='') {
  return value.replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function spin() {
  const movies = eligibleMovies();
  if (state.spinning || !movies.length) return;
  state.spinning = true;
  state.selected = null;
  $('resultCard').classList.add('hidden');
  const winnerIndex = Math.floor(Math.random() * movies.length);
  const slice = (Math.PI * 2) / movies.length;
  const target = (Math.PI * 2 * (5 + Math.random() * 3)) - (winnerIndex * slice + slice / 2);
  const startRotation = state.rotation;
  const start = performance.now();
  const duration = 4200;

  function animate(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    state.rotation = startRotation + target * eased;
    drawWheel();
    if (progress < 1) requestAnimationFrame(animate);
    else {
      state.spinning = false;
      state.rotation %= Math.PI * 2;
      state.selected = movies[winnerIndex];
      $('resultTitle').textContent = state.selected.title;
      $('resultCard').classList.remove('hidden');
      drawWheel();
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
    }
  }
  requestAnimationFrame(animate);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function snapshotUrl() {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ movies: state.movies, history: state.history }))));
  const url = new URL(location.href);
  url.search = '';
  if (state.room) url.searchParams.set('room', state.room);
  url.searchParams.set('list', payload);
  return url.toString();
}

async function copyShare() {
  const url = state.room ? `${location.origin}${location.pathname}?room=${encodeURIComponent(state.room)}` : snapshotUrl();
  if (navigator.share) {
    try { await navigator.share({ title: 'Movie Night Wheel', text: 'Join our movie-night wheel!', url }); return; } catch {}
  }
  await navigator.clipboard.writeText(url);
  toast('Invite link copied');
}

async function setupFirebase() {
  if (!firebaseConfig) return;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
    state.firestore = getFirestore(initializeApp(firebaseConfig));
    $('syncDot').classList.add('live');
    $('syncLabel').textContent = 'Live sync ready';
  } catch (err) {
    console.error(err);
    toast('Firebase setup failed');
  }
}

async function joinRoom(roomCode) {
  if (!roomCode) return toast('Enter a room code');
  state.room = roomCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('room', state.room);
  history.replaceState({}, '', url);
  $('roomCodeInput').value = state.room;

  if (!state.firestore) {
    $('syncLabel').textContent = `Snapshot room: ${state.room}`;
    toast('Room link ready; live sync needs Firebase');
    return;
  }

  const { doc, onSnapshot, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  state.unsubscribe?.();
  const ref = doc(state.firestore, 'rooms', state.room);
  state.unsubscribe = onSnapshot(ref, async (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      state.movies = data.movies || [];
      state.history = data.history || [];
      saveLocal();
      render();
    } else {
      await setDoc(ref, { movies: state.movies, history: state.history, updatedAt: Date.now() });
    }
  });
  $('syncDot').classList.add('live');
  $('syncLabel').textContent = `Live room: ${state.room}`;
  toast('Joined live room');
}




$('unlockForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const entered = $('passwordInput').value;
  if (entered !== appConfig.accessCode) {
    $('lockError').textContent = 'That access code is not correct.';
    $('passwordInput').select();
    return;
  }
  if ($('rememberDevice').checked) localStorage.setItem(UNLOCK_KEY, appConfig.accessCode);
  else sessionStorage.setItem(UNLOCK_KEY, appConfig.accessCode);
  unlockApp();
});

$('showPasswordBtn').addEventListener('click', () => {
  const input = $('passwordInput');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('showPasswordBtn').textContent = showing ? 'Show' : 'Hide';
  input.focus();
});

$('lockBtn').addEventListener('click', lockApp);

document.querySelectorAll('.add-tab').forEach((tab) => tab.addEventListener('click', () => switchAddMode(tab.dataset.addMode)));

$('bulkInput').addEventListener('input', () => {
  const count = parseBulkTitles($('bulkInput').value).length;
  $('bulkPreview').textContent = `${count} title${count === 1 ? '' : 's'} detected`;
});

$('bulkForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const titles = parseBulkTitles($('bulkInput').value);
  if (!titles.length) return toast('Paste at least one movie title');

  const existing = new Set(state.movies.map((movie) => movie.title.trim().toLocaleLowerCase()));
  const newTitles = titles.filter((title) => !existing.has(title.toLocaleLowerCase()));
  const duplicateCount = titles.length - newTitles.length;
  const owner = $('bulkOwnerInput').value;
  const genre = $('bulkGenreInput').value;
  state.movies.push(...newTitles.map((title) => ({ id: uid(), title, owner, genre, watched: false })));
  $('bulkInput').value = '';
  $('bulkPreview').textContent = '0 titles detected';
  await syncState();
  render();
  if (!newTitles.length) toast('Those movies are already on the list');
  else toast(`Added ${newTitles.length} movie${newTitles.length === 1 ? '' : 's'}${duplicateCount ? ` · skipped ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}` : ''}`);
});

$('movieForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = $('titleInput').value.trim();
  if (!title) return;
  state.movies.push({ id: uid(), title, owner: $('ownerInput').value, genre: $('genreInput').value, watched: false });
  event.target.reset();
  await syncState();
  render();
});

$('movieList').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const movie = state.movies.find((m) => m.id === button.dataset.id);
  if (!movie) return;
  if (button.dataset.action === 'delete') state.movies = state.movies.filter((m) => m.id !== movie.id);
  if (button.dataset.action === 'toggle') movie.watched = !movie.watched;
  await syncState();
  render();
});

document.querySelectorAll('.filter-chip').forEach((chip) => chip.addEventListener('click', () => {
  document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  state.filter = chip.dataset.filter;
  render();
}));

$('spinBtn').addEventListener('click', spin);
$('spinAgainBtn').addEventListener('click', spin);
$('markWatchedBtn').addEventListener('click', async () => {
  if (!state.selected) return;
  const movie = state.movies.find((m) => m.id === state.selected.id);
  if (movie) movie.watched = true;
  state.history.unshift({ ...state.selected, watchedAt: new Date().toISOString() });
  state.selected = null;
  $('resultCard').classList.add('hidden');
  await syncState();
  render();
});

$('clearHistoryBtn').addEventListener('click', async () => {
  state.history = [];
  await syncState();
  render();
});

$('shareBtn').addEventListener('click', copyShare);
$('roomBtn').addEventListener('click', () => $('roomDialog').showModal());
$('joinRoomBtn').addEventListener('click', () => joinRoom($('roomCodeInput').value));
$('copyInviteBtn').addEventListener('click', copyShare);

initializeAccessGate();
loadLocal();
await setupFirebase();
const initialRoom = new URLSearchParams(location.search).get('room');
if (initialRoom) await joinRoom(initialRoom);
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
}
