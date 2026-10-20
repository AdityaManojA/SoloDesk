# Functional review — 19 October 2026

SoloDesk was exercised in the **local demo**, using visibly named review records. No real client account or external calendar was modified. The TaskFlow reference was read from `D:/Projects/TaskFlow/design/DESIGN_BRIEF.md` and `design/prototype/index.html`; TaskFlow itself was not edited.

## Evidence

- `npm run check`: **27 automated tests pass**; production build passes.
- `qa/browser-checks.json`: **32 recorded browser assertions pass**. This is a saved result, not a reusable automation script.
- Downloads were retrieved through the actual UI and their contents parsed locally.
- Representative 320px, 390px and 768px frame viewports plus the desktop browser were inspected. A currency wrapping issue found at phone width was corrected. This is not a complete browser/device matrix.

| Area | Exercised | Result / limit |
| --- | --- | --- |
| Authentication | Missing-config Google button, enter demo, exit demo, re-enter/reload | Local paths pass; real Google login not configured |
| Navigation | All dock destinations, More, header report/settings links, detail routes, create menu | Pass; More title corrected |
| Dialogs | Each create shortcut; Escape; required name; confirmation cancellation | Pass |
| Clients | Create with contact fields, search, edit notes, archive and restore | Pass |
| Projects | Linked creation; start/end validation; status change; search and status filters; completion | Pass |
| Tasks | Create with due date, client/project and timed 90-minute block; mismatch validation; edit; complete/reopen; combined four-way filters; empty results | Pass |
| Task deletion | Open confirmation and cancel | Pass for cancellation; permanent deletion not executed |
| Invoice editor | Add/remove lines; quantity/price/tax; invalid due date; save draft; edit notes | Pass: 250 subtotal + 25 tax = 275 |
| Invoice lifecycle | Mark sent; reject 1000 overpayment on 275 balance; receive 100; receive remaining 175; void; reissue | Pass in demo. Original invoice/payments retained; new draft has a new number and no payments |
| Draft deletion | Open confirmation and cancel | Pass for cancellation; permanent deletion not executed |
| Invoice PDF | Printable invoice markup and existing button retained | Actual system Print/Save as PDF flow **not executed** |
| Reports | Native date range changes and payment-derived totals | Pass: October payments = 3075 in the review workspace, outstanding = 3600 |
| Settings | Currency change/save, payment instructions, persistence, local test PNG upload, remove logo, invalid-file error | Pass; test settings restored to USD/empty instructions |
| Account deletion | Confirmation/cancel | Pass for cancellation; live deletion not executed. Source now reauthenticates before deleting, and disables deletion while saves are pending |
| CSV exports | Clients/projects/tasks/invoices/payments | Downloaded and parsed: 4/4/5/8/7 records with consistent columns; includes scheduler fields |
| Workspace JSON | Full workspace export | Downloaded/parsed; currency/settings and records preserved |
| Event exports | Full JSON, full ICS and one-event ICS | 6 events in full and monthly exports; one VEVENT in single export; 10:00 Asia/Calcutta block exported at 04:30Z |
| Calendar | Month forward/back, client/type filters, completed toggle, month/agenda view, selected event, linked editor, overflow-day agenda and monthly ICS export | Pass. Local-time day overlap/UTC/all-day behavior covered by tests |
| Calendar setup instructions | Google/Apple import and subscription steps | Added in app and docs; provider-side imports/subscriptions not executed |
| API auth/keys | Missing/bad auth, owner isolation, read-only scope, expiration, revocation, CORS, pagination | Automated tests use fake repositories. Real Firebase Admin/Firestore integration and key UI remain unverified |
| Save failure/retry | Queued writes, retry and tab-close protection retained | Cloud/network failure behavior not exercised |

## Corrections made during review

1. Reissued overdue invoices previously retained a due date before their new issue date. Reissues now use a valid future due date when required; regression test covers preservation of the original record.
2. Account deletion previously deleted the workspace before confirming recent authentication. Reauthentication now happens first. This is still not an atomic cross-service operation; cloud failure/recovery needs staging verification.
3. The mobile financial cards split currency digits onto a new line after applying TaskFlow’s larger type. Responsive financial type now keeps the tested values intact.
4. Added the missing full Calendar route and per-event export, with local date handling, client/type filters, month/agenda views, a selected-day agenda and editing from events.
5. Matched TaskFlow’s cream, ink outlines, pastel cards and raised-add floating dock, without changing the accounting/API data model.

## What to add next (proposed, not implemented)

1. Recurring tasks and subtasks for repeatable client delivery workflows.
2. Drag-and-drop time blocking, working hours and conflict warnings; preserve project spans as free availability.
3. A direct Google Calendar OAuth connection with a stored source-ID/provider-ID mapping, retries, sync status and duplicate protection.
4. Invoice due-date follow-up reminders and per-client subscription filters.
5. Key-expiry reminders and a visible last-successful-sync status. Subscription keys currently expire after 90 days.

## Launch boundary

There is no `.env.local` Firebase web configuration here and the API was not deployed in this review. External Google/Apple calendars, cloud writes, live credentials, actual PDF save and permanent deletion remain unverified. Tests do not demonstrate a production deployment or an accessibility certification.

Final production-tab console inspection reported no warnings or errors. Updated screenshots are `qa/screenshots/dashboard-taskflow.png` and `qa/screenshots/calendar-taskflow.png`; earlier screenshots show the previous design pass.
