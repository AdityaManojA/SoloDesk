# Workspace upgrades — 20 October 2026

## Delivered

| Feature | Where / behavior |
| --- | --- |
| Safe syncing | Cloud saves compare the exact loaded document in a Firestore transaction. A stale tab cannot overwrite a newer saved version. A conflict preserves pending work and offers backup export and an explicit Load latest action. |
| Backup & restore | More → Backup & restore. JSON file preview, schema/amount/date/type validation, unsafe-key rejection, matching-ID counts, merge or confirmed replacement. Merge keeps current values for duplicate IDs; it does not deduplicate names/emails or merge conflicting field edits. Portal credentials and memberships are separate. |
| Week/day calendar | Calendar → Week / Day. 24 hourly rows, all-day records, mouse/touch pointer drag to another day/hour, 15-minute duration resizing, and existing precise task editing as an accessible alternative. Shared TaskFlow/Google events stay read-only. |
| Dependencies | Task details → Dependencies, notes & checklist. Rejects self-links, missing prerequisites and cycles. Blocked tasks cannot transition to Done until prerequisites finish. |
| Client portal | Client details → Client portal. Owner enters client email and an initial password for a new account, selects projects/sent invoices, and publishes a separate read-only snapshot. Existing verified accounts retain their credentials. Revoke removes access. |
| Project budgets | Project editor → Budget hours / Hourly rate. Projects shows budget versus logged focus effort, remaining/over-budget hours and time value; time value is not revenue. |
| Notes & checklists | More → Notes & checklists, with project links, editable note bodies, checkbox progress and recoverable deletion. Task details have their own notes and checklists. |
| Dashboard customization | Settings → Make your dashboard yours. Show/hide summary cards, revenue/attention and tasks/projects. |
| Commands | Workspace toolbar → Commands or Ctrl/Command Shift P. Create records and navigate. Ctrl/Command K remains search. |
| Archive & Trash | Task/project lists have Archive and Show archived controls. Trash offers an individually confirmed permanent removal and clears Undo history for that action. |
| Offline support | Public app shell cached by a generated service worker. Account-scoped session-storage snapshots/pending changes support reload/reconnect in the same tab. Reconnect retries transaction-based saves and reports conflicts. Sign-out clears that account's recovery copy. |

## Checks

- **103 unit tests pass**, plus the production build. Seven new tests cover transaction baselines, backup modes/duplicates/invalid inputs, dependency graphs, budget math and portal whitelisting.
- `qa/portal-rules.mjs` passes against local Firestore/Auth emulators. Checks owner writes, recipient queries, unrelated/anonymous denial, forbidden client mutations, private-workspace isolation, revocation, verified-email invitations, access after workspace deletion and preservation of TaskFlow owner rules. Also checks actual Firebase SDK transactions reject stale saves and separate Auth provisioning leaves the owner logged in. A transient SDK emulator network failure on the first expanded run cleared on rerun; the final run passed.
- `qa/offline-shell.mjs` verifies that all generated precache entries exist, offline navigation falls back to public HTML, and API/Auth/Firestore requests are not intercepted. This tests worker behavior in an isolated harness, not a physical device's airplane mode.
- Browser demo: added a note with two checklist items and checked one; moved a timed task to another day/hour and resized 60 → 90 minutes; task details showed the persisted result. Added a prerequisite and confirmed Mark complete was rejected.
- Browser demo: dashboard summary visibility changed from Settings; command menu opens with a focus-trapped dialog and was moved to a body portal so the mobile dock cannot cover it. Client setup shows email/password, existing-account choice and sharing controls; publication is disabled in demo mode.
- Layout checks at 320×568 for backups, notes, projects, settings and calendar found no document horizontal overflow. Week view deliberately scrolls horizontally within its calendar container; Day view fits the phone width.
- Password/account tests used synthetic local-emulator accounts only. No private live workspace was used or modified.

## Operational notes

Portal updates require **Publish latest selected data**; this is deliberate sharing, not automatic publication. The shared Auth account is kept on revocation and workspace deletion. Reset email delivery and a real-client end-to-end round trip still need an account-level check.

Offline recovery is **tab-session scoped**, not a durable offline database. Browser session restoration may retain it, but closing the tab or signing out can discard it. Storage quota errors can prevent a recovery copy; pending work remains in memory and backup export is available. The public shell must be prepared online before first offline use. Browser worker updates may activate after old app tabs close. Always export a backup for durable recovery.

The single-document Firestore size limit remains. Safe syncing detects conflicts rather than automatically merging edits. Load latest discards pending work only after confirmation; export it first and use backup merge to recover non-conflicting new IDs. Permanent deletion cannot erase copies already exported, cached in another tab or held by other applications.

## Deployment scope

Firebase Auth email/password provider enabled through the project configuration API, retaining Google. Firestore rules are merged with the currently deployed rules, including TaskFlow's newer `taskflowBoard` block, and copied to the TaskFlow-controls rules file. Deploy only Firestore rules and SoloDesk Hosting. No functions, TaskFlow Hosting deployment or real client account creation is needed.

Evidence: [client setup](screenshots/client-portal-setup.png), [week calendar](screenshots/calendar-week-upgrade.png).

Release verified at `https://taskflow-solodesk.web.app`: main asset `index-DVvztXmX.js`, matching `sw.js`, no-cache policy, existing security headers, client setup and client email/password login screens, and Settings reporting offline readiness. No warning/error logs were observed during the live smoke test. Anonymous requests to portal, owner workspace and TaskFlow share paths returned 403. The deployed rules compiled successfully. Only SoloDesk Hosting and the merged Firestore rules were deployed; functions and TaskFlow Hosting were left alone.

To repeat the access tests, use Java 21+ and run `firebase emulators:exec --config firebase.test.json --project demo-solodesk-test --only firestore,auth "node qa/portal-rules.mjs"`. The script rejects non-local emulator hosts and uses synthetic accounts. Run `npm run check` before `node qa/offline-shell.mjs` for the generated worker check.
