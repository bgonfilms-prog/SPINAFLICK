# Movie Night Wheel

A mobile-friendly, installable web app for two people to add movies, spin an animated wheel, track watched picks, and share an invite link.

## Features

- Animated canvas wheel
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

## Deploy free

Upload this folder to GitHub and deploy with GitHub Pages, Netlify, or Vercel. No build command is required.

## Enable live syncing for both partners

1. Create a Firebase project.
2. Add a Web App in Firebase.
3. Enable Firestore Database.
4. Copy the Firebase web configuration into `firebase-config.js`.
5. For a private two-person app, start with these Firestore rules and tighten them later if desired:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
    }
  }
}
```

For stronger privacy, add Firebase Authentication and rules that restrict each room to invited users.

## Share behavior

- Without Firebase: the Share button sends a snapshot link containing the current list and history.
- With Firebase: create or join a room and share the room link for live updates on both phones.
