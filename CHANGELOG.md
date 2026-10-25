# SoloDesk release notes

The same notes appear in the app under **Settings → What's new**, and people who used an earlier version see a short "SoloDesk updated" note the first time they open a new one. The source of truth is [`src/changelog.js`](src/changelog.js); keep this file in step with it.

## 1.02 — 25 October 2026 · A new look, and your whole client business in one place

- **New design.** A calmer, business-ready look: a black sidebar, warm Terracotta colours (sage, sand, cream) and clearer type (Bricolage Grotesque and Figtree, served with the app) across every page, in light and dark.
- **Choose your action colour.** Settings → Appearance lets each workspace pick its highlight colour: Terracotta (default), Clay, Rust, Apricot, Sienna, Brick, Peach or Dusty blue. Buttons stay black.
- **Jump back in.** Home shows the three most recently edited clients, projects and TaskFlow quests, plus revenue, what needs attention, a month calendar and today's timeline.
- **All work.** A new page lists every project, client and completed piece of work as cards, newest first.
- **Client and project notes.** Notes, checklists and dated reminders on each client and project. Dated to-dos show on Home and in the client's Reminders.
- **Project pages.** Every project has its own page with Tasks, Notes, Files & docs and Budget.
- **Files & docs.** Write PRDs in SoloDesk (problem, goals, out of scope, requirements), turn requirements into linked tasks, and link files from Drive, OneDrive, Notion or Figma.
- **Live Excel sync (coming soon).** Shown as "Coming soon" in Files & docs until the server part is deployed. Link a Microsoft Excel workbook to a project or client. Task name, status, due date and priority sync both ways; logged hours go to the sheet; conflicting edits wait for you to choose. Needs the Blaze plan and a Microsoft app registration — see [docs/excel-sync-setup.md](docs/excel-sync-setup.md).
- **Public profile.** A mini portfolio at `/<username>` with your headline, bio, links and chosen client names. Private by default: visitors then see only your name and a note that the profile is private.
- **Edit invoices on the page.** On a draft, change the invoice number, title, dates, reference/PO, your details, bill-to, line items, tax label and rate, notes, payment instructions and bank details (account, bank, IFSC/sort code, SWIFT, IBAN, UPI). Save bank details as your default from the invoice or in Settings → Invoices & bank.
- **What's new.** Release notes in Settings, a one-time update note, and the version in the sidebar.

Fixes
- Edits now record when they happened, so "most recent" is always accurate.

## 1.01 — 25 October 2026 · Calendar on phones and a new identity

- Throughline identity: new logo and app icon, with a downloadable logo pack.
- Calendar source markers on every date.
- Clients, projects, tasks, invoices, calendar, TaskFlow connection, planning tools, client portal, Undo/Trash/backups, installable app, dark mode and offline access.

Fixes
- On phones, the Start time field in Conflicts & free time no longer runs past the card.
- On phones, the project popup in Calendar stays on screen and its Move to date field fits.
