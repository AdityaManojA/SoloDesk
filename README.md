# SoloDesk

Freelancer business manager: clients, projects, tasks, invoices (PDF + payments), dashboard, reports, CSV export.
Stack: React 18 + Vite, Firebase Auth (Google sign-in), Firestore, Firebase Hosting.

## Where things are
| File | Purpose |
|---|---|
| `src/firebase.js` | Firebase init (config read from `.env.local`) |
| `src/lib.js` | Invoice maths, statuses, reports, CSV, PDF |
| `src/App.jsx` | Google login, floating nav, all pages and dialogs |
| `src/styles.css` | Yale Blue / Lemon Chiffon theme, pill nav, responsive layout |
| `firestore.rules` | Each user can only read/write `users/{their uid}` |
| `firebase.json` | Hosting (serves `dist`) + rules config |

## Setup
1. Firebase console: create a project, add a **Web app**, copy its config into `.env.local` (see `.env.example`).
2. Authentication > Sign-in method > enable **Google**. Authentication > Settings > Authorized domains: add your hosting domain.
3. Build > Firestore Database > create database.
4. Run:
```
npm install
npm run dev                         # local
npm run build
npm i -g firebase-tools && firebase login
firebase use --add                  # pick your project
firebase deploy --only hosting,firestore:rules
```

## GitHub
```
git init && git add . && git commit -m "SoloDesk MVP"
git branch -M main
git remote add origin https://github.com/<you>/solodesk.git
git push -u origin main
```
`.env.local` is git-ignored, so no keys are committed.
