# Invoice and client fixes — 20 October 2026

New/edit invoice now offers inline client creation. Saving the client selects it while retaining invoice dates, lines, tax and notes. Empty workspaces can create their first client directly. Cancelling the client editor restores focus to the client selector. Client creation from Clients uses the same trimmed-name/contact validation.

Invoice saves validate the client, real issue/due dates, date order, descriptions, quantities, prices and tax. Only drafts can be edited. Invoice numbering recovers from missing/string/stale counters using existing invoice numbers; reissue uses the same allocator. The shared dropdown no longer silently displays the first option when its actual value is missing, and empty dropdowns are disabled.

## Verified

- `npm run check`: 47 tests passed; production build passed. Eight invoice-input tests cover client validation, invalid/archived clients, draft-only edits, dates, amounts and numbering recovery.
- Local browser demo: created two clients inline and INV-0009/INV-0010; details persisted after reload. Blank client name showed a visible error. Adding a client retained line items, tax and notes.
- Edited INV-0010 quantity from 1 to 2; number stayed unchanged and total changed from $200 to $400. Cancelling inline client creation preserved the client and edited quantity and restored dropdown focus.
- Marked that demo invoice sent and recorded a $150 demo payment; status became partially paid and balance $250.
- Created INV-0011 for the existing QA Client A with two lines ($50 + $25); total $75, demonstrating multiple invoices for the same client.
- Test records are local demo data, not live financial activity.

## Limits

Live Google sign-in and authenticated Firestore saves were not exercised. No claim of exhaustive logic coverage or completed cloud/network-failure testing. Shared Firebase rules, TaskFlow data and functions deployment are unchanged.
