# Bug & security review — 20 October 2026

Reviewed browser authentication/session handling, workspace saves, deletion/recovery, scheduling and recurrence, focus totals, external links, CSV/ICS exports, shared TaskFlow reads, Firestore rules, Hosting headers and the optional server API. This is a targeted code/dependency review with live smoke checks, not a complete penetration test.

## Confirmed issues fixed and deployed

| Finding | Change | Evidence |
| --- | --- | --- |
| **Medium: missing browser security headers.** The live site allowed framing and had no content security policy. | Hosting now sends CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and disabled camera/microphone/geolocation permissions. CSP restricts scripts and connections while allowing Firebase authentication. | Verified all five headers on the deployed HTTPS response. Demo sign-in page, planner, global search and custom date picker render without warning/error logs in the browser. Actual Google popup completion still needs an account-level test. |
| **Medium: restoring orphaned records.** Delete a task, then its client, then restore the task: it returned with missing client/project references. | Restore now validates the complete proposed bundle before applying it and asks for the parent to be restored first. | Regression test verifies rejection leaves the workspace unchanged, then restores the client bundle followed by the task successfully. |
| **Medium: oversized workspace saves failed without a useful explanation.** Trash and history increase the single document's size. | Check serialized UTF-8 size before a cloud write. Oversized changes stay in the current tab with an explicit backup/Undo/reduction message and an unsaved state. This does not expand storage or migrate data. | Tests verify Unicode byte accounting, no write for oversized data, and success after reducing the data. Limit is conservatively 1,000,000 bytes to leave document overhead below Firestore's limit. |
| **Low: focus totals broke for project names such as `__proto__` or `constructor`.** A plain object was used as a name-indexed accumulator. | Use a Map to calculate totals. | Regression test confirms both names produce correct numeric totals. This was a display/calculation bug, not a demonstrated remote-code exploit. |
| **Low: logo resizing only bounded width.** Extremely tall images could produce a large canvas and saved image. | Bound both image dimensions to 240 pixels. | Production build passes; source review confirms aspect ratio is preserved. Extreme-image browser stress testing was not performed. |

Firestore documents are limited to [1 MiB including document overhead](https://firebase.google.com/docs/firestore/quotas); [Firebase's size calculation](https://firebase.google.com/docs/firestore/storage-size) explains the overhead. The size check improves failure handling but the single-document design still needs a future migration for large workspaces.

## Remaining findings

1. **High reliability priority: concurrent editing can lose changes.** `App.jsx` loads a snapshot with `getDoc`, then saves the whole JSON using `setDoc`. The per-session save queue prevents ordering bugs within that session, but does not coordinate tabs or devices. An isolated two-queue stale-snapshot simulation confirmed the second writer replaces the first writer's new task. Follow up with revision checks/transactions and an explicit conflict/reload flow, or migrate records into separate documents. Avoid simultaneous editing for now. No real user's cloud data was modified to reproduce this.
2. **Medium, before enabling the currently undeployed API: workspace deletion does not revoke integration keys.** The shared Auth account intentionally survives workspace deletion. Existing unexpired keys are stored separately, so recreating a workspace under that account would make those keys usable again. Add server-side revocation or a workspace generation binding before deploying the API. This is not an exposed endpoint on the current Spark deployment.
3. **Medium reliability limitation: stored workspace schema is trusted.** A malformed legacy or externally edited JSON document can pass JSON parsing but fail later when views expect arrays/valid records. Add versioned schema validation and a recovery/export screen before any future import feature. No arbitrary HTML rendering was found in the reviewed components.

## Verification

- `npm run check`: **96 tests passed**, production build passed; four new regression tests were added.
- Root `npm audit --json`: **0 reported vulnerabilities** across 135 dependencies.
- Functions `npm audit --json`: **0 reported vulnerabilities** across 245 dependencies. This package is not deployed.
- Tracked-file and source scan found no service-account private keys or live integration secrets. Only example environment files are tracked. The browser's Firebase web configuration is public by design; access depends on Auth and rules.
- Rules retain owner checks on both `solodeskWorkspaces/{uid}` and `taskflowUsers/{uid}/**`. Unmatched collections default to denial. Read-only HTTP probes to a nonexistent workspace, TaskFlow share document and integration key each returned **403** without authentication. Authenticated cross-account reads/writes were not exercised; that needs separate test accounts or a rules emulator.
- TaskFlow code subscribes only to the signed-in user's `share/open` document, clears account state on change, and has no TaskFlow write/chunk-read path. Shared event links are restricted to HTTPS and exclude embedded credentials.
- Existing tests cover API ownership/scope/revocation, CSV formula escaping, calendar injection escaping, date/DST boundaries and save-queue isolation. Passing tests do not prove absence of other vulnerabilities.
- Deployed only `hosting:solodesk`, with live main asset `index-BrXC5lZw.js`. Rules, functions and the TaskFlow Hosting site were not deployed.
- Full Google sign-in, two-account rules tests, physical phone testing and authenticated cloud-save round trips remain unverified in this review.

Browser smoke-test evidence: [live app screenshot](screenshots/security-review-live.png).
