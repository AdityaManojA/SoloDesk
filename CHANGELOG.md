# SoloDesk release notes

The same notes appear in the app under **Settings → What's new**, and people who used an earlier version see a short "SoloDesk updated" note the first time they open a new one. The source of truth is [`src/changelog.js`](src/changelog.js); keep this file in step with it.

## 1.07 — 25 October 2026 · Small improvements

- **Your client’s name in their portal.** The top of the client portal shows the client’s name as you set it in SoloDesk, with their initials and login email, instead of only the email.

## 1.06 — 25 October 2026 · Client portals that keep themselves up to date

- **No more “Update portal”.** A client’s portal now updates by itself a moment after you change anything you share with them: task progress, project dates, documents, PRDs, links or invoices.
- **Pick what to share, instantly.** Under Client access, ticking or unticking a project, document or invoice changes the portal straight away. A live dot shows when it last published.

## 1.05 — 25 October 2026 · Client approvals, a new client portal and smart typing

- **Send work for approval.** Open a task and choose Send for approval. Your client approves it or asks for changes in their portal, and the answer comes back to the task. A new Approvals page shows what is waiting, approved or needs changes.
- **A client portal that shows the work.** Clients now see the project tasks you share, their links, the documents and PRDs you pick, and sent invoices, in a new colourful portal with their approvals at the top. Copy the portal link straight from Client access.
- **Type it, and it fills in.** Like TaskFlow: type “Send the draft to Ava tomorrow at 7pm” and the date, time, client and project fill themselves in. Suggestions appear as you type; press Tab to pick one. Works for tasks, projects (“from Nov 3 to Dec 20”), search and checklist reminders.
- **Search by day.** Search for “tomorrow” or “next Friday” to see the work on that day.
- **Clearer document buttons.** Link a file and New PRD are now two clear buttons with a short description each.
- **Free and busy days.** Every day in the calendar is coloured by how full it is — free, light, busy or packed — with a count of items and clients. The year view becomes a heatmap of your free days.
- **Projects across every day.** Project timelines now stretch across every day they cover in the month view, instead of showing only at the start of each week.
- **Ongoing projects.** Leave a project’s end date empty and it runs on from its start date until you add one.
- **Add a client while creating a project.** “Add a new client” sits right under the client list in the project form.
- **Effort budget when you need it.** Budget hours and hourly rate only appear when you tick “Track an effort budget”.
- **Clickable breadcrumb.** The path at the top left now links back: Workspace goes Home, the section opens its list, and the last part shows the client, project or note you are on.
- **More action colours.** Eight new presets — coral, mustard, olive, sage, teal, sky, lavender and stone — plus a Custom colour picker for any shade you like.
- **Links on clients.** Add a client’s website, Instagram or any other link in the client form. Type just “acme.com” and SoloDesk fills in the rest; links show under the client’s name.
- **Safer portal passwords.** When you create a client portal login you type the password twice, and clients must enter their current password before setting a new one.
- **Completed projects out of the way.** When you pick a project for a task, finished projects are tucked under a greyed-out “Completed projects” row at the bottom of the list. Click it to show them.
- **A fresh welcome.** Onboarding and the guided tour were redone in the new colours and now walk through Home, Notes, Calendar zoom and free days, your Profile and Settings.

Fixes
- Calendar zoom buttons are easier to spot.
- Radio buttons and checkboxes no longer stretch across the whole row (for example “Who can see it?” in profile setup).
- Removed the logo download section from Settings → Appearance.

## 1.04 — 25 October 2026 · Edit what you were working on, right from Home

- **Jump back in, editable.** Home shows the notes, tasks, projects and clients you edited most recently (never TaskFlow quests). Notes open in place under the cards; tick checklist items and tasks straight from a card; project and client cards open their editors.
- **TaskFlow, tucked away.** Quests sit in a small pill next to the greeting with a quick list.
- **Checklists like Apple Notes.** Enter for the next item, Tab / Shift+Tab to nest and un-nest, Enter on an empty sub-item steps out, Backspace at the start outdents or joins with the item above. Ticking an item ticks its sub-items; items keep their place.
- **Notes, side by side.** The Notes page lists notes on the left and opens the selected one on the right, ready to type — no pop-up windows.
- **Calendar zoom buttons.** Labelled Zoom in / Zoom out, plus Ctrl/⌘ + scroll or a trackpad pinch over the calendar.

Fixes
- Note fields no longer show a form-style box while typing.
- Text typed just before closing a note is saved; notes save less often while you type.

## 1.03 — 25 October 2026 · A clearer calendar, Keep-style notes and a tidier workspace

- **Calendar, rebuilt.** One zoom control from Year → Month → Week → Day (also keys Y, M, W, D and T for today). A "What you're working on" timeline above every zoom level shows each client's projects as bars across the period. Month view packs multi-day projects into bars like Google Calendar; Week and Day are hourly timelines with a now line; the Day view adds a plan of what is due, scheduled and running, plus the free-time tools. Drag-to-reschedule, Move to date and ICS export remain.
- **Notes like Google Keep.** Title plus "Take a note…", or switch on the checklist: Enter adds the next item, Backspace on an empty item removes it, ticked items collect at the bottom, and any item can carry a reminder date. The Notes page shows every note, including client and project notes, with filters and search.
- **Take a note from Home** — a shortcut under Add task.
- **Profile setup walkthrough** — address (availability checked as you type), about you, links, clients to show, and visibility (private by default).
- **Settings on one page** — General, Invoices & bank, Appearance, Data & connections, What's new and Account in one scroll; the sticky tabs follow the section you're reading.
- **Cleaner toolbar and sidebar account area** — quick actions, search (⌘K), reports, settings and light/dark in one pill; your initials, name, email and log-out button at the bottom of the sidebar.
- **Uniform project cards** with Archive and Delete side by side.
- **Palette colours** in Reports and for TaskFlow items.

Fixes
- Removed the "All changes saved" label; the top bar only shows saving progress or a save problem.

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
