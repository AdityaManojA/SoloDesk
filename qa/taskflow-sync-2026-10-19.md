# TaskFlow shared feed

## Completed
- Replaced SoloDesk rules with the supplied TaskFlow rules; SHA-256 hashes match exactly.
- Deployed Firestore rules successfully before implementing the feed.
- Added one owner-scoped browser snapshot listener for `taskflowUsers/{uid}/share/open`.
- Added read-only quest list, calendar events, TaskFlow-only filter, source links, missing/error/retry states and demo isolation.
- Updated privacy disclosure to describe the shared feed.
- No TaskFlow writes, internal chunk reads, Cloud Functions deployment, codebase changes or TaskFlow Hosting deployment.
- All 34 automated tests and production build passed.
- Deployed only `hosting:solodesk` to `taskflow-solodesk`.
- Verified the live Tasks page displays the From TaskFlow section with its explicit demo/sign-in message. No real feed records are shown in demo mode.

## Pending real-account validation
TaskFlow's Google sign-in was initiated through Settings. It remained at Signing in while the provider popup was not exposed through the controlled browser; no account was authenticated and no test quest was created. Same-account live snapshot arrival, completion/removal and shared Google event display are not claimed as verified. The user was asked to sign in to both apps with the same Google account and add a dated SoloDesk sync check quest.

Quest repeat labels are preserved; future dates are not expanded independently of TaskFlow. One-minute timed quest display/export slots are free deadline reminders, not reserved work sessions. All-day end dates from the shared calendar remain exclusive.
