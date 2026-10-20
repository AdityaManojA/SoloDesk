# Productivity features — 20 October 2026

Implemented the nine approved items. Payment follow-ups/reminder messages were excluded; existing invoice/payment records and controls are retained.

## Features and access

1. Calendar conflicts and suggested free intervals: Daily planner or Calendar → Conflicts & free time. Uses timed SoloDesk blocks and loaded TaskFlow busy events. Project spans/deadlines remain free. All-day Google events shared as busy block their covered days. Touching endpoints do not conflict.
2. Unscheduled task tray: Calendar. Drag an undated open SoloDesk task onto a visible date to assign its deadline, including the currently selected day. Schedule opens a time/duration form with free-time suggestions. The same form in Planner schedules any open SoloDesk task. TaskFlow remains read-only.
3. Global search: header search icon or Ctrl/Command K. Searches clients, projects, tasks, invoices and loaded shared quests/events. Projects open their editor; other local results open details, external results open their safe source link. Search doesn't open over another dialog.
4. Undo & Trash: workspace toolbar and More. Up to 20 in-memory changes can be undone in order; history resets on reload/sign-out. Deletions go to persistent Trash. Client bundles recover linked records; project restoration reverses unlinks while preserving unrelated task edits. Restoration refuses conflicts atomically. Invoice/payment recovery does not overwrite later payment changes. Custom templates and recurring schedules are recoverable too. No permanent-delete or automatic purge action was added.
5. Recurring work: task editor supports daily, weekdays, weekly and monthly repetition after completion. One child occurrence is created per completed parent, guarded against retries/toggling/deletion. Monthly day anchors survive short months, and scheduled/deadline day offsets remain consistent. More → Recurring drafts snapshots an existing invoice; Generate due drafts creates at most 24 pending occurrences per schedule per click. IDs/dates prevent duplicates. Rules can pause/resume or move to Trash. Drafts are never sent or paid automatically.
6. Project templates: workspace toolbar or More. Two starter workflows, custom task/day-offset templates, copy tasks from an existing project, and optional invoice milestones. Applying a template creates a client-linked project, dated tasks and uniquely numbered unsent milestone invoices.
7. Client activity timeline: client details. Recent create/update/complete/delete/restore activity plus existing project dates, task deadlines, invoices and recorded payments. Planned dates are explicitly marked; historical edits before this update aren't reconstructed.
8. Focus timer: task details, toolbar or More. Start/pause/resume/finish across routes and reloads, with task/project history and per-project logged totals. Runs from stored wall-clock timestamps, so closing the app doesn't pause it. Maximum logged session is 24 hours; no per-second Firestore writes.
9. Daily planner: toolbar or More. Date and working-hours controls, task priorities, shared quests, appointments/deadlines, conflicts and scheduling suggestions. Connection status qualifies availability when TaskFlow is missing, cached or loading.

## Verification

- 92 automated tests and production build pass. 17 new tests cover recurrence boundaries and idempotency, cascade recovery and conflicts, payment restoration, busy overlaps and all-day boundaries, free intervals, validated scheduling, same-day tray drops, search, templates, invoice schedules, timelines, focus and workflow restoration.
- Browser checks used an isolated local demo origin (`localhost:4180`) with synthetic QA records. No signed-in account was read or modified for these checks.
- Created a custom two-task template with two invoice milestones; applied it and verified INV-0007/0008 drafts and linked tasks. Generated one recurring invoice draft, then verified the next click produced zero duplicates.
- Completed a weekly task and verified one next-week Todo occurrence. Verified global search across clients/projects/tasks/invoices and that a project result opens its editor.
- Deleted a QA project, recovered it with Undo, deleted it again and restored it from Trash. Removed/restored a recurring invoice schedule while preserving its generated invoice.
- Started a focus timer, navigated to client details and back, paused and logged a 13-second session under the restored project. Inspected the client timeline's tasks, generated invoices and original demo payments.
- Scheduled QA blocks, detected their overlap, fixed a native time-input/state issue, and verified exact 10:30 start + 45-minute duration. A second block at 10:45 produced one conflict that persisted after reload.
- Performed an actual pointer drag from the unscheduled tray onto 22 October: task left the tray and the calendar confirmed the move.
- Layout observations at 320×568 across planner, templates, recurring drafts, focus, Trash, calendar, client details and More had no horizontal overflow. Inspected desktop planner/templates, dark phone planner and search. Search was portaled out of the header so the dock no longer covers its controls.
- Screenshots: `screenshots/productivity-planner-desktop.png`, `screenshots/productivity-templates-desktop.png`, `screenshots/productivity-planner-mobile-dark.png`.

## Limits

Phone checks use viewport emulation; no physical touch device was tested. Live Google authorization/cloud round trips need an account-level check. Availability reflects only currently loaded shared data and TaskFlow's existing primary-calendar range. Recurring invoices are generated by an explicit browser action, not a background service. Workspace size is still constrained by the existing single Firestore document. Trash has no time-based purge, activity keeps 500 recent changes, and focus history stays with the workspace. Concurrent editing across multiple browser tabs retains the app's existing whole-document save behavior.

## Release

Deployed only `hosting:solodesk` to `taskflow-solodesk.web.app`; rules, functions and TaskFlow Hosting were not deployed. Live demo verified asset `index-CxWTTF4R.js`, Planner with availability/scheduling controls, Templates, Recurring drafts, Focus, Trash and Calendar. No live workspace records were edited. Release screenshot: `screenshots/productivity-planner-live.png`.
