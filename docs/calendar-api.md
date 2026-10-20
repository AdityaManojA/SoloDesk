# Calendar and scheduler integration

SoloDesk supplies a one-way timeline. Your calendar remains responsible for display, conflicts, notifications and sync cadence. No calendar provider has been connected yet.

## Choose a connection

- **Import a snapshot:** Integrations → Export calendar · ICS. Import this file using your calendar app. Repeated file imports may duplicate events depending on the calendar.
- **Subscribe:** after API deployment, sign in → Integrations → name your app → Calendar events only → Create API key. Save the subscription URL shown once; use your calendar provider’s Subscribe by URL feature. The provider decides refresh timing. Keys expire after 90 days; renew the subscription URL before expiry.
- **Custom scheduler:** keep the key on your server and fetch `GET /api/v1/calendar` with `Authorization: Bearer YOUR_API_KEY`. Use the helper in `examples/pull-calendar.mjs` or the sample below. Never embed the key in a publicly served JavaScript bundle.

The subscription URL grants access to event titles and client/project context. Treat it as a secret. Only calendar-only keys work in query-string subscription URLs. Normal JSON requests require the Authorization header.

## Event model

| Source | Calendar event | Availability |
| --- | --- | --- |
| Task with Scheduled start | UTC timed block for Duration (5–1440 minutes) | Busy |
| Task with only Due date | All-day deadline on its due date | Free |
| Project with Start / End | All-day span; form end date is inclusive | Free |
| Project with only End | Single all-day milestone | Free |
| Project with only Start | Single all-day milestone | Free |
| Undated task/project | Omitted | — |
| Done task / Complete project | Omitted by default | — |

Project spans and deadline reminders do **not** reserve your entire day. Only timed tasks reserve availability. On-hold projects remain visible. If a task has both a time and due date, it produces one work block; its due date stays in metadata. No recurrence, automatic conflict resolution, two-way editing, webhooks or provider-specific OAuth is implemented.

Task times are entered in the browser/device timezone and stored as UTC instants. All-day dates do not shift with timezone. End is exclusive throughout the API and ICS. A project ending October 30 has an event end of October 31. Clients without dated work have no standalone events; client IDs and names accompany related work. Private contact details, notes and invoice values are excluded from calendar-only access.

```json
{
  "data": [{
    "id": "task-example",
    "type": "task",
    "title": "Design review",
    "start": "2026-10-20T04:30:00.000Z",
    "end": "2026-10-20T06:00:00.000Z",
    "allDay": false,
    "availability": "busy",
    "durationMinutes": 90,
    "due": "2026-10-22",
    "status": "In progress",
    "priority": "High",
    "client": { "id": "client-example", "name": "Example client" },
    "projectId": "project-example",
    "projectName": "Brand project",
    "description": "Example client · Brand project · High priority · Due 2026-10-22",
    "path": "/tasks/example"
  }],
  "meta": { "schemaVersion": 1, "exportedAt": "2026-10-19T12:00:00.000Z", "total": 1, "limit": 100, "offset": 0, "nextOffset": null }
}
```

This response is illustrative. IDs and actual dates come from your workspace.

## Endpoints

All paths are relative to the deployed SoloDesk origin. `VITE_API_BASE_URL` can override the browser base for local development.

| Method/path | Access | Response |
| --- | --- | --- |
| GET `/api/v1/calendar` | Calendar or workspace key, or Firebase ID token | JSON event list |
| GET `/api/v1/calendar.ics` | Same; also calendar-only `?key=...` subscription | Complete ICS feed |
| GET `/api/v1/workspace` | Workspace key or ID token | Full workspace; computed invoice data |
| GET `/api/v1/clients`, `/projects`, `/tasks`, `/invoices`, `/payments` | Workspace key or ID token | Paginated records |
| GET `/api/v1/summary` | Workspace key or ID token | Received revenue, outstanding balance, work counts |
| GET/POST `/api/v1/keys` | Firebase ID token only | List metadata / create key |
| DELETE `/api/v1/keys/:id` | Owner’s Firebase ID token only | Revoke key |

Calendar endpoints accept `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, and `includeCompleted=true`. Filters include overlapping project spans. Date bounds are inclusive calendar dates; timed events are compared in UTC. JSON lists accept `limit` (default 100, max 500) and non-negative `offset`. ICS returns all matching events without pagination. Error bodies use `{ "error": { "message": "..." } }` with 400/401/403/404/405/409 or a generic 500. All responses disable caching.

## Polling correctly

1. Fetch every page for the same date range. Follow `meta.nextOffset` until null. Do not update your scheduler from a partial/failed fetch.
2. Upsert under a SoloDesk source namespace using stable event `id`. A title or date edit keeps its ID.
3. After a **complete, successful** refresh, remove previously imported SoloDesk events that overlap the same range but are absent from the new result. This handles completions, deletions, and rescheduling outside the range. Leave unrelated calendar events alone.
4. Poll at a cadence appropriate for your application. A multi-page read is not an atomic snapshot: for a rapidly changing workspace, refresh again or use an unpaginated ICS subscription. Rate limiting, push notifications, and delta tokens are not implemented.

## Deployment prerequisites

Deploy the included Firebase HTTP function and Hosting rewrite. Configure exact allowed origins in `functions/.env.<project-id>` using `API_ALLOWED_ORIGINS=https://YOUR_HOST` (include local dev origin only if needed). Server-to-server clients need no Origin header. The live browser origin must be allowed for creating/revoking keys. Firestore client rules continue to permit only the signed-in user’s `solodeskWorkspaces/{uid}` document; key records are server-only by default deny.

Raw API keys are generated on the server and shown once. Stored records contain SHA-256 hashes, prefix, name, UID, scope and expiry. Keys are read-only, expire after 90 days and can be revoked. Maximum 10 active keys per account. Disabled/deleted accounts cannot use keys. Revocation stops future reads; it cannot erase copies already imported by another application. Key metadata retention and cloud request/log retention should be reviewed before production.

Authoritative implementation references: [Firebase HTTP functions](https://firebase.google.com/docs/functions/http-events), [ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

## View and import one item at a time

In SoloDesk open **Calendar** in the bottom dock (`#/calendar`). Navigate months, switch to Agenda, or select a day. Client/type/completed filters affect the view and monthly export. Click an event to open its details, then **Export this event · ICS**. Open its editor to change its underlying task/project.

**Google Calendar (computer):** Settings → Import & export → Select file from your computer → choose the single-event ICS → choose the destination calendar → Import. Repeat for each chosen item. Imports are copies and do not keep syncing. [Official Google guide](https://support.google.com/calendar/answer/37118?hl=en).

**Apple Calendar (Mac):** File → Import → select the ICS → choose a calendar → import. Repeat for the desired items. [Official Apple guide](https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac). For a whole-calendar subscription on iPhone/iPad: Calendar → Calendars → Add Calendar → Add Subscription Calendar → paste the deployed feed address, then follow Find/Subscribe for your OS version. [Official iCloud subscription guide](https://support.apple.com/en-us/102301).

**Ongoing feed:** Google Calendar web → Other calendars → + → From URL; Apple Calendar Mac → File → New Calendar Subscription. Use the URL shown once when creating a calendar-only key. Localhost is not reachable by Google’s servers or other devices. The endpoint must be deployed at a reachable HTTPS origin. Feed refresh is controlled by the provider and has not been tested against either service here. Keys expire in 90 days. Anyone who has the URL can read the feed.

Avoid mixing repeated file imports with a subscription to the same events; separate copies can appear. Direct Google insertion would require Calendar API OAuth, a dedicated destination calendar, source/provider ID mapping and update/delete reconciliation. Google sign-in for SoloDesk alone does not grant Calendar API access. [Google event creation guide](https://developers.google.com/workspace/calendar/api/guides/create-events).
