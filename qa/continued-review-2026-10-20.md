# Continued functionality and installation review — 20 October 2026

## Confirmed fixes

1. Integrations' browser export filters passed local date inputs into UTC API filtering. For example, 20 October at 00:30 in India is 19 October at 19:00 UTC, and could be omitted by a 20 October filter. Browser exports now filter whole local days, including overlapping events and exclusive all-day ends. API filtering semantics remain unchanged.
2. Cloud saves previously shared one promise chain across sign-in sessions; an old offline operation could block the next account, and an old completion could publish stale status after an authentication change. A session-owned queue now serializes each account's saves independently, ignores obsolete status callbacks, and skips old queued writes that have not started. Already-issued network writes are not cancelled. Firebase still enforces ownership.

## Checks completed

- `npm run check`: **67 tests passed**, production build passed. Six new tests cover local export boundaries, timezone regression, ordered writes, account switches with deferred failures, sign-out cancelling queued work, and failed-save retry. Network/account behavior is simulated in these tests.
- Browser: created a local demo task at 00:30 on 20 October in Asia/Calcutta. Selected From/Through 20 October with the date pickers; the UI showed four events. Downloaded JSON contained the midnight task and excluded tasks on 22/24 October. Screenshot: `screenshots/local-date-export-review-2026-10-20.png`.
- Reload retained the demo task. Sign-out returned to Google login, where Add to Home Screen remained available.
- Reviewed payment recording, deletion, scheduling, integration/export and authentication paths. Existing regression tests continue to cover these functions; this is not a claim that every device/production scenario was manually replayed.
- Installation metadata/icons and platform instructions were verified in the previous installation pass; no service worker or offline functionality was introduced here.

## Still unverified or unavailable

Native install dialogs/shortcuts on physical iOS, Android, Windows/macOS devices; standalone Google login; authenticated Firestore writes and real account-switch tests; live TaskFlow feed interactions. The available in-app browser cannot substitute for physical-device checks. Cloud API deployment remains unavailable on the current Spark setup; the direct browser-to-Firestore integration remains in place. No billing change, functions/rules deployment, TaskFlow write, or deletion of existing user data was performed.
