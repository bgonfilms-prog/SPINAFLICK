# Reel Roulette — Movie Night Wheel

A mobile-friendly, installable web app for two people to add movies, spin an animated wheel, track watched picks, and share an invite link.

## Features

- Animated canvas wheel
- Add one movie or bulk-import up to 250 titles at once
- Bulk input accepts one title per line, commas, or semicolons and skips duplicates
- Add movies with owner and genre
- Filter by unwatched, mine, or partner's picks
- Mark movies watched and review history
- Mobile share sheet / copyable invite URL
- Snapshot sharing works without a backend
- Optional live shared rooms with Firebase Firestore
- Installable PWA with offline caching

## Run locally

Because the app uses JavaScript modules, serve it with a local web server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Secure deployment on Vercel

This version uses a Vercel serverless function for TMDB searches. The browser calls `/api/movies`; the function adds the TMDB bearer token on the server, so the credential is not included in the downloadable JavaScript.

1. Upload this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Leave the Framework Preset as **Other** and deploy with the default settings.
4. Open the Vercel project’s **Settings → Environment Variables**.
5. Add an environment variable named `TMDB_READ_ACCESS_TOKEN` and paste your TMDB API Read Access Token as its value.
6. Apply it to Production and Preview, save it, and redeploy the project.
7. Open the generated Vercel URL. Movie suggestions should now appear as you type.

Do not put the real token in `app-config.js`, `.env.example`, GitHub, or any browser-delivered file.

For local testing with Vercel CLI, copy `.env.example` to `.env.local`, enter your token, and run:

```bash
npx vercel dev
```

## Enable live syncing for both partners

1. Create a Firebase project.
2. Add a Web App in Firebase.
3. Enable Firestore Database.
4. Copy the Firebase web configuration into `firebase-config.js`.
5. Add Firebase Authentication and restrict Firestore access to your two accounts before storing anything sensitive.

## Share behavior

- Without Firebase: the Share button sends a snapshot link containing the current list and history.
- With Firebase: create or join a room and share the room link for live updates on both phones.

## Password protection

The app opens behind a shared access-code screen and can remember trusted devices.

1. Open `app-config.js`.
2. Replace `movie-night` with the access code you and your partner want to use.
3. Deploy the changed files.
4. Share the website link and send the access code separately.

The lock button in the top-right immediately locks the app again.

Important: the current access-code screen is still a client-side privacy gate. The TMDB token is protected by the serverless function, but true user-level app security requires Firebase Authentication or another server-side login system.

## Movie title autocomplete

Autocomplete now calls the included `/api/movies` serverless function. If the environment variable is missing or the service is temporarily unavailable, the app falls back to its built-in popular-title list and titles already saved on the wheel.
