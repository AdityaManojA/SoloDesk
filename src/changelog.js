// Release notes shown in Settings → What's new, in the update notice, and mirrored in CHANGELOG.md.
// Newest first. Add an entry for every user-facing change: put it in the unreleased version while it is
// being built, and set released + date when it ships.
export const changelog=[
  {version:'1.02',released:true,date:'2026-10-25',title:'A new look, and your whole client business in one place',highlights:[
    ['New design','A calmer, business-ready look: a black sidebar, warm Terracotta colours and clearer type across every page.'],
    ['Choose your action colour','Pick the highlight colour for your workspace in Settings → Appearance. Terracotta is the default.'],
    ['Jump back in','Home shows your three most recently edited clients, projects and TaskFlow quests, with revenue, what needs attention and today’s timeline.'],
    ['All work','See every project, client and completed piece of work as cards, newest first.'],
    ['Client and project notes','Keep notes, checklists and dated reminders on each client and project. Reminders also show on Home.'],
    ['Project pages','Every project now has its own page with tasks, notes and files.'],
    ['Files & docs','Write PRDs in SoloDesk, turn their requirements into tasks, and link files from Drive, OneDrive, Notion or Figma.'],
    ['Live Excel sync','Link a Microsoft Excel workbook to a project or client. Task edits flow both ways and SoloDesk asks before overwriting anything. Available once your workspace administrator switches it on.'],
    ['Public profile','A mini portfolio with your links and chosen clients at your own address. Private by default.'],
    ['Edit invoices on the page','Change the invoice number, title, your details, bill-to and bank details right on a draft invoice, and save bank details as your default.'],
    ['What’s new','Release notes like these, in Settings, and a short note after each update.'],
  ],fixes:[
    'Edits now record when they happened, so “most recent” is always accurate.',
  ]},
  {version:'1.01',released:true,date:'2026-10-25',title:'Calendar on phones and a new identity',highlights:[
    ['Throughline identity','A new SoloDesk logo and app icon, with a downloadable logo pack in Settings.'],
    ['Calendar source markers','Every date shows which connected calendars have events on it.'],
    ['Clients, projects, tasks & invoices','Your whole client business in one private workspace.'],
    ['Calendar','Month and agenda views, drag work to a new date, and export to Google or Apple Calendar.'],
    ['TaskFlow connection','See TaskFlow quests and shared Google Calendar events next to your work.'],
    ['Planning tools','Daily planner, conflicts & free time, focus timer, project templates and recurring invoice drafts.'],
    ['Client portal','Share chosen projects and sent invoices with a client.'],
    ['Safety nets','Undo, Trash, and backup & restore. Install as an app, dark mode and offline access.'],
  ],fixes:[
    'On phones, the Start time field in Conflicts & free time no longer runs past the card.',
    'On phones, the project popup in Calendar stays on screen and its Move to date field fits.',
  ]},
];
export const currentVersion=()=>changelog.find(entry=>entry.released)?.version||'1.01';
// Whether to show the "SoloDesk updated" note: only to people who used an earlier version.
export function shouldShowUpdate(seenVersion,returning){
  if(!returning)return false;
  return !seenVersion||Number(seenVersion)<Number(currentVersion());
}
