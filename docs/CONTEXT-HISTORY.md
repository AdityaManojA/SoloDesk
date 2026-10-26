# Terracove (formerly SoloDesk) — context history, October 2026

A record of this chapter of work: what was built, what was tried and dropped, what broke and how it was fixed,
the decisions that now constrain the codebase, and what is still open. It covers 25–26 October 2026, from the
1.01 mobile fixes to the 1.13 rename. Release-by-release notes for users live in [CHANGELOG.md](../CHANGELOG.md)
and in the app (Settings → What's new); this file is the working history behind them.

---

## 1. Where things stand (26 Oct 2026)

| | |
|---|---|
| **Name** | **Terracove** (renamed from SoloDesk in 1.13) |
| **Live version** | 1.13 — https://taskflow-solodesk.web.app |
| **Repo** | `D:\Projects\Solodesk-MVP`, branch `main`, tags `v1.02`…`v1.13` |
| **Stack** | React 18 + Vite, Firebase Auth / Firestore / Hosting, hash routes |
| **Firebase** | Project `taskflow-dailytracker` (shared with TaskFlow), Hosting target `solodesk`, **Spark plan** (Blaze expected ~mid-Nov 2026) |
| **Tests** | 164 passing (`npm run check` = tests + production build) |
| **Rules** | Shared with TaskFlow; TaskFlow's copy at `D:\Projects\TaskFlow-controls\firestore.rules` must stay identical |

Deploy commands (the user allowed these for this project):

```
firebase deploy --only firestore:rules  --project taskflow-dailytracker --account aditya.dev.org@gmail.com
firebase deploy --only hosting:solodesk --project taskflow-dailytracker --account aditya.dev.org@gmail.com
```

Rules go first whenever both change. Never deploy Hosting for TaskFlow's site or functions from here.

---

## 2. Standing decisions and constraints

These came out of this chapter and should be kept unless the user says otherwise.

- **Design direction B, Terracotta palette**: sage `#A7B98B`, sand `#EFCB8A`, cream `#F8F2E6`, ink `#141414`, hero/action terracotta `#E8957A`. Type: Bricolage Grotesque (display) + Figtree (body), via `--font-display` / `--font-body`. Buttons stay black; the action colour is for highlights.
- **Never pink, never lime.** Pink was removed entirely (an NDA with a previous black-and-pink client). Lime was rejected.
- **Action colour = 16 presets only.** A custom colour picker was added (1.05) and then **removed** (1.10) because a dark custom colour makes black text unreadable. Old custom values still load but show as Terracotta.
- **UI changes need approval.** Design first (Figma file `bnt8lsuv1xdCg4xHFitxvZ`, page 68:234) or show it in chat; a direct request from the user counts as approval.
- **Every user-facing change goes in `src/changelog.js`** (Settings → What's new), mirrored in `CHANGELOG.md` and the README, released as a version with a git tag. `functions/changelog.test.js` pins the current version.
- **Data names are frozen.** After the rename, Firestore collections stay `solodeskWorkspaces`, `solodeskPortals`, `solodeskProfiles`, `solodeskSync*`; browser keys stay `sd_*`; cache names, the `SOLODESK_URL` function parameter and the Hosting site `taskflow-solodesk` stay. Renaming any of these would orphan user data and client links.
- **Don't commit `.claude/`** (local `launch.json` for the preview server).
- **Gmail, not Outlook**, for anything that drafts email (meeting requests open Gmail compose; "use my email app" is the secondary link).
- **No "Live" badges** — the user found the pulsing indicator noisy; it now says "Shared".

---

## 3. Release timeline

| Version | When | Headline |
|---|---|---|
| 1.01 | 25 Oct | Calendar on phones; Throughline identity |
| 1.02 | 25 Oct | New design (Terracotta), recent work, notes, profiles, invoice editing, Excel sync (as "coming soon") |
| 1.03 | 25 Oct | Rebuilt calendar (Year/Month/Week/Day zoom), Keep-style notes, tidier workspace |
| 1.04 | 25 Oct | Home edits recent work in place, Apple-Notes-style nested checklists, two-pane Notes |
| 1.05 | 25 Oct | Free/busy calendar, client approvals, new client portal, smart typing (from TaskFlow) |
| 1.06 | 25 Oct | Client portals publish themselves (no "Update portal" button) |
| 1.07 | 25 Oct | Client's name in the portal header |
| 1.08 | 25 Oct | Jump back in opens the record; revenue off Home; clearer project timeline |
| 1.09 | 25 Oct | Approvals for PRDs/files/quotes, billable hours, split storage, notifications, client requests, quick add |
| 1.10 | 25 Oct | Settings search; custom colour removed; stale tabs can't overwrite portals |
| 1.11 | 26 Oct | Client requests actually save (rules bug); Gmail meeting link; password behind a button |
| 1.12 | 26 Oct | Open a task in the portal; clients can change an approval answer |
| 1.13 | 26 Oct | **SoloDesk is now Terracove** |

---

## 4. What was built, by area

### 4.1 Design and app shell
- Full UI revamp to Direction B / Terracotta, designed in Figma first, then built (1.02–1.04).
- Clickable breadcrumb (Workspace → section → record name) (1.05).
- Onboarding and guided tour redone in the new style: six welcome steps (Home, Notes, Clients, Calendar, Profile, Make it yours), nine tour stops (1.05).
- Radio buttons and checkboxes fixed (were stretching full width under a global `input` rule) (1.05).
- Logo-download section removed from Settings → Appearance (1.05).
- Shorter sidebar: Daily planner opens from Calendar ("Plan your day"), Reports from the top bar (1.09).
- Dark-mode contrast fixes for calendar chips, day counts, timeline captions, delete buttons (1.09).
- Note editor: title/body are plain text on the note's colour, not white form boxes (1.09).

### 4.2 Home
- "Jump back in": three latest edits (notes, tasks, projects, clients), editable in place; TaskFlow quests as a small pill (1.04).
- Clicking a task/project/client tile now **opens its page** instead of the edit form; notes still open in place (1.08).
- Revenue card removed from Home ("dont need this here"); Needs attention is full width; revenue lives in Reports (1.08).
- Requested changes from clients appear in Needs attention (1.09).

### 4.3 Calendar
- Year/Month/Week/Day zoom with buttons, Ctrl/⌘ + scroll and pinch (1.03–1.04).
- Free / light / busy / packed colouring per day, with item and client counts; year view as a heatmap (1.05).
- Project bars span every day they cover; ongoing projects (no end date) run on (1.05).
- "What you're working on" timeline rebuilt: a column per day with weekday + date, month label on the 1st, weekend shading, a today line in each row, non-overlapping projects share a lane, square/›/fade bar ends for projects that continue or are ongoing (1.08).

### 4.4 Tasks and projects
- Project form: add a client inline, effort budget behind a checkbox, optional end date (= ongoing) (1.05).
- Completed projects tucked into a collapsed "Completed projects" group in project pickers (1.05).
- TaskFlow repeats: every other day, yearly, and on chosen weekdays (day buttons in the form) (1.09).
- Invoice unbilled hours: a project's Budget tab shows logged vs not-yet-invoiced time; one click makes a draft invoice, one line per task at the hourly rate, rounded to 15 min; deleting the draft frees the time (1.09).
- Task page redesigned: status switch (Todo / In progress / Done), details panel, client conversation, approval box, focus timer (1.09).
- Tasks list: priority, due, approval and project chips; a "By project" grouped view (1.09).

### 4.5 Smart typing (ported from TaskFlow)
- `src/smart-parse.js` ports TaskFlow's `parseQuest` (`TaskFlow-controls/app/js/parse.js`) and adds clients/projects: "Call Ava tomorrow 7pm for Website" fills date, time, client, project, priority, repeat (1.05).
- `src/SmartField.jsx`: suggestions as you type (names and date words), Tab/Enter to pick, chips showing what was understood.
- Used in the task form, project form ("from Nov 3 to Dec 20"), search (by day: "tomorrow", "next Friday") and checklist items ("Call Ava tomorrow" → reminder) (1.05).
- A distinctive first word matches a client ("Northstar" → Northstar Studio; "The" is skipped) (1.09).
- **Quick add from anywhere**: press **N** or Ctrl/⌘ J (or the bolt) → one line → Enter adds the task (1.09).

### 4.6 Search
- Day-aware search (1.05).
- Settings and pages are searchable by the words people use ("bank", "IFSC", "GST", "dark mode", "backup"); picking one opens the section, highlights it and focuses the field (`src/settings-index.js`) (1.10).

### 4.7 Clients, documents, invoices
- Client links (website, socials) with bare-domain entry ("acme.com") (1.05).
- Client summary card on Overview: portal status + Copy portal link, approvals waiting, links (1.09).
- Documents: clearer "Link a file" / "New PRD" buttons (1.05); the Excel "Coming soon" card shrank to one line (1.09).
- Confirm-password field when creating a portal login (1.05).

### 4.8 Client portal (`src/ClientPortal.jsx`)
- Redesign: dark hero with the owner's action colour, stat tiles, tabs (Approvals, Projects & tasks, Links & documents, Requests, Invoices, Settings) (1.05–1.09).
- Shares project tasks, the client's links, chosen documents/PRDs and sent invoices (1.05).
- **Auto-publishing**: no "Update portal" button; the portal republishes a couple of seconds after any shared change (1.06).
- Client's name and initials in the header (1.07).
- Clients can comment on tasks, send "💪 You got this", request a change, add/update their links and shared file addresses, and request a meeting (1.09).
- **Requests**: clients ask for something new; the owner answers from Approvals with Feature scope / We'll start right away / Can be implemented / In progress / Custom timing, optionally adding it as a task (1.09; made to actually save in 1.11).
- Settings tab with account details; password change behind a "Change password" button (1.09, 1.11).
- Click a task card to open its steps, approval and comments; **change an approval answer** later (1.12).
- `#/portal-preview` shows the portal with sample data (no login).

### 4.9 Approvals
- Send tasks for approval; client approves or requests changes in the portal; the answer syncs back (1.05).
- Extended to PRDs (approval marks the PRD Approved), linked files, and draft invoices as quotes (1.09).
- Approvals page with counts, "Ready to send?", and client requests (1.05, 1.09).
- Clients can change their answer; the newest answer wins (1.12).
- Approval emails written as Firebase functions (`functions/approval-functions.js`, `approval-mail.js`) for the Trigger Email extension — **not deployed** (needs Blaze). Setup: [approval-emails-setup.md](approval-emails-setup.md).

### 4.10 Notifications
- Bell in the top bar: approvals answered, comments, cheers, change requests, new client requests, link updates, overdue invoices, reminders, tasks due today. Read state syncs (`settings.notificationsSeenAt`).
- Count on the Approvals menu item for new answers and unanswered requests (1.09).

### 4.11 Storage
- Workspaces were one Firestore document (1 MB cap). Since 1.09, notes, docs, activity, focus history and trash live in `solodeskWorkspaces/{uid}/parts/{list}.{n}` (~900 KB each); the main document keeps `core`, `parts`, `v: 2`, and a `json` marker that old app versions refuse to load (so they can't save a partial workspace). Saves are a transaction that checks a canonical baseline, writes only changed parts and deletes unused ones (`src/workspace-store.js`). Verified live on the owner's workspace.

### 4.12 Rename
- 1.13: every visible "SoloDesk" became "Terracove" (app name, wordmark, titles, manifest, emails, downloads, legal pages, docs). Data names unchanged (see §2).

---

## 5. Things tried, problems hit, and how they were resolved

| What happened | Cause | Resolution |
|---|---|---|
| Heredocs with quotes broke in the Bash tool | Shell quoting | Write Python/CSS to the scratchpad and run it |
| Browser-pane screenshots were cropped/zoomed or stale | Pane device pixel ratio / hidden pane | Verify by measuring the DOM (bounding boxes, computed styles, contrast ratios) instead of screenshots |
| Dev preview kept serving old code for the portal | Browser module cache in the pane | Verified on the live build instead |
| Custom action colour | User worried about black/unreadable colours | Removed (1.10); presets only |
| Pink / lime palettes | User preference and NDA | Removed / rejected |
| Squashed task titles (one letter per line) in portal cards | Chips took the row width | Row wraps; title keeps ≥140 px (1.10) |
| Link editor cramped in narrow cards | Four controls on one line | Stacked fields, buttons below (1.10) |
| **Portal flickered / jumped** | Every tab republished on any portal change; a stale tab (old code) kept overwriting the new one | Publish only after a tab's own edits; publishes carry `wsStamp` (newest change) and an older copy never overwrites a newer one (1.10); **rules now require the stamp and forbid it going backwards**, which blocked the old tab server-side |
| A rules deploy was blocked once by the auto-mode permission check | Rules deploy is shared/production | Asked the user; they approved, then deployed |
| **Client requests appeared then vanished** | The rule's wildcard was named `{request}`, hiding Firestore's built-in `request`, so every create was denied | Renamed to `{requestId}` (1.11) |
| `ERR_BLOCKED_BY_CLIENT` in the client's console | An ad blocker blocking Firestore channels | Not an app bug; noted for testing |
| Meeting request opened Outlook | `mailto:` uses the OS default | Gmail compose link first; "Use my email app" second (1.11) |
| A test link update never arrived | Not confirmed whether it was sent or blocked by the ad blocker | Still to re-test (§7) |
| Hook added after an early return in `ClientPortal` | Code placement | Moved the state up with the others |
| Escaped quotes left in JSX by a regex edit | Edit script | Fixed; build check caught it |
| Quick-add Ctrl+J may be taken by Chrome (Downloads) | Browser shortcut | Added **N** as a second shortcut |

---

## 6. Testing done

- **Automated**: 164 tests across parsing, approvals, billing, storage (including a fake-Firestore transaction test: stale tab rejected, old single-document workspace upgrades), notifications, client updates, settings search, changelog, rules-adjacent logic.
- **Signed-in end-to-end (live, owner's real workspace, in the user's Chrome)**:
  - Backup exported by the user first.
  - Workspace loaded on 1.09: 4 clients, 9 projects, 3 open tasks, 4 invoices, 2 notes.
  - Saved a test note, cleared the tab cache, reloaded — note persisted, counts matched; Firestore showed `v: 2` with `notes.0`, `docs.0`, `activity.0` parts. Test note moved to Trash.
  - Portal for client **hytz** (`hytz@gmail.com`): auto-publish confirmed; a test task "E2E portal test, safe to delete" sent for approval.
  - From the client side (private window): change request ("Need more options") synced to the task; three cheers arrived; bell showed 5 new; Approvals count 2; meeting draft and Settings tab checked.
  - Not yet confirmed: a client request after the 1.11 rules fix, and a client link update.
- **Dark mode / phone**: contrast measured on seven pages (fixed what failed); no sideways scrolling at 375 px.

---

## 7. Open items and next steps

**Testing**
- Re-test from the client window on 1.12+: send a request, add `example.com` under Links & documents, then reply to the request from Approvals and check the label appears in the portal.
- Clean up test data: task "E2E portal test, safe to delete", the test comments/cheers, and any test request.
- An old SoloDesk tab or installed app was still running pre-1.09 code somewhere; it is blocked by the rules now, but should be reloaded/closed.

**Name (Terracove)**
- Trademark checks done: USPTO, WIPO Global Brand Database, and India's register (classes 9, 35, 42, exact and phonetic, with a calibration search that proved hits are returned). No "Terracove" in software/SaaS/business classes in India or the US.
- Near-marks to show an attorney: **TERRA CORE** (India, class 35, Prime Woods Global LLP, application 7624901, under examination); **Teracove** (Korea, class 35, registered); **Terracov** (Indonesia, class 35, pending); TERRACODE (US, class 42, farming SaaS, pending). Unrelated-goods "Terracove" registrations exist in the US (furniture, artificial flowers) and Germany (machines/appliances/furniture).
- Domains: terracove.com, .io, .co, .in taken; **terracove.app, getterracove.com, terracovehq.com, terracove.co.in looked free** on 25 Oct.
- To do (user): buy terracove.app, get an attorney's clearance, file "Terracove" in India (classes 9, 42, optionally 35), later Madrid.
- To do (code): move Hosting to the new domain once bought; consider a separate Firebase project for Terracove.

**Platform**
- Move to **Blaze** (~mid-Nov 2026), then: deploy approval emails (Trigger Email extension + `functions:approvals`), Excel live sync, daily Firestore backups, error tracking.
- Limit client posting (Firebase App Check and per-client limits) to prevent comment/request spam.
- Update the Privacy Policy for portal data (comments, requests, client links); add Terms of Service before charging.
- Decide whether to keep `#/portal-preview` public.
- An uncommitted TaskFlow leaderboard edit sits in `firestore.rules` (EXP refill 15 → 60 per hour); it was not made in this chapter and was left out of every commit. It needs a decision, then a commit, the same edit in TaskFlow's copy, and a rules deploy.

**Suggestions not yet done**
- Separate Firebase project for Terracove (rules coupling and billing isolation with TaskFlow).
- Server-side portal publishing once Blaze is on, so it no longer depends on an open tab.

---

## 8. Key files

| Area | Files |
|---|---|
| App shell, pages, forms | `src/App.jsx` |
| Client portal (owner + client) | `src/ClientPortal.jsx`, `src/portal-sync.js`, `src/client-feed.js` |
| Approvals | `src/approvals.js`, `src/Approvals.jsx` |
| Notifications | `src/notifications.js`, `src/Notifications.jsx` |
| Smart typing, quick add | `src/smart-parse.js`, `src/SmartField.jsx`, `src/CommandMenu.jsx` |
| Search | `src/ProductivityUI.jsx` (WorkspaceSearch), `src/settings-index.js` |
| Storage | `src/workspace-store.js`, `src/workspace-upgrades.js` (validation, `publishablePortal`, `workspaceStamp`, `portalUpdate`) |
| Billing | `src/billing.js` |
| Calendar | `src/Calendar.jsx`, `src/calendar-view.js` |
| Notes | `src/NotesKeep.jsx`, `src/checklist.js` |
| Styles | `src/theme.css` (loaded last; overrides older CSS) |
| Release notes | `src/changelog.js`, `CHANGELOG.md`, `README.md` |
| Rules | `firestore.rules` (+ TaskFlow copy) |
| Server code (not deployed) | `functions/approval-*.js`, `functions/excel-*.js` |
