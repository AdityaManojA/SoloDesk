// Release notes shown in Settings → What's new, in the update notice, and mirrored in CHANGELOG.md.
// Newest first. Add an entry for every user-facing change: put it in the unreleased version while it is
// being built, and set released + date when it ships.
export const changelog=[
  {version:'1.05',released:false,date:'',title:'See your free days at a glance',highlights:[
    ['Free and busy days','Every day in the calendar is coloured by how full it is — free, light, busy or packed — with a count of items and clients. The year view becomes a heatmap of your free days.'],
    ['Projects across every day','Project timelines now stretch across every day they cover in the month view, instead of showing only at the start of each week.'],
    ['Ongoing projects','Leave a project’s end date empty and it runs on from its start date until you add one.'],
    ['Add a client while creating a project','“Add a new client” sits right under the client list in the project form.'],
    ['Effort budget when you need it','Budget hours and hourly rate only appear when you tick “Track an effort budget”.'],
    ['Clickable breadcrumb','The path at the top left now links back: Workspace goes Home, the section opens its list, and the last part shows the client, project or note you are on.'],
    ['More action colours','Eight new presets — coral, mustard, olive, sage, teal, sky, lavender and stone — plus a Custom colour picker for any shade you like.'],
    ['A fresh welcome','Onboarding and the guided tour were redone in the new colours and now walk through Home, Notes, Calendar zoom and free days, your Profile and Settings.'],
  ],fixes:[
    'Calendar zoom buttons are easier to spot.',
    'Radio buttons and checkboxes no longer stretch across the whole row (for example “Who can see it?” in profile setup).',
    'Removed the logo download section from Settings → Appearance.',
  ]},
  {version:'1.04',released:true,date:'2026-10-25',title:'Edit what you were working on, right from Home',highlights:[
    ['Jump back in, editable','Home now shows the notes, tasks, projects and clients you edited most recently. Open a note, tick a checklist item or a task, or edit a project or client without leaving Home.'],
    ['TaskFlow, tucked away','Your TaskFlow quests sit in a small pill next to the greeting; tap it for a quick list.'],
    ['Checklists like Apple Notes','Type an item, press Enter for the next one, Tab to make a sub-item and Shift+Tab to move it back. Ticking an item ticks its sub-items, and items stay where you put them.'],
    ['Notes, side by side','The Notes page lists your notes on the left and opens the one you pick on the right, ready to type. On Home, a note opens right under your recent work.'],
    ['Zoom buttons in the calendar','Clear Zoom in and Zoom out buttons, plus Ctrl/⌘ + scroll or a trackpad pinch over the calendar.'],
  ],fixes:[
    'Note fields no longer show a form-style box when you type in them.',
    'Text typed just before closing a note is no longer lost, and notes save less often while you type.',
  ]},
  {version:'1.03',released:true,date:'2026-10-25',title:'A clearer calendar, Keep-style notes and a tidier workspace',highlights:[
    ['Calendar, rebuilt','Zoom from the whole year down to a single day, like Google or Apple Calendar. A “What you’re working on” timeline shows every client’s projects across the period, and the day view explains what is due, scheduled and running.'],
    ['Notes like Google Keep','Take a note, or switch on the checklist and press Enter for each new item. Ticked items move to the bottom, any item can have a reminder date, and every note — including client and project notes — is on the Notes page.'],
    ['Take a note from Home','A “Take a note…” shortcut sits under Add task on Home.'],
    ['Set up your profile','A short walkthrough helps you pick your address (checked as you type), introduce yourself, add links and choose who can see it.'],
    ['Settings on one page','Scroll through General, Invoices & bank, Appearance, Data & connections, What’s new and Account. The tabs follow along as you scroll.'],
    ['Cleaner toolbar and account area','Quick actions, search (⌘K), reports, settings and light/dark mode sit together in one bar; your name and log out sit neatly at the bottom of the sidebar.'],
    ['Even project cards','Every project card is the same size, with Archive and Delete side by side.'],
    ['Your colours everywhere','Reports and TaskFlow items now use the SoloDesk palette.'],
  ],fixes:[
    'The “All changes saved” label is gone; SoloDesk only speaks up while saving or if something did not save.',
  ]},
  {version:'1.02',released:true,date:'2026-10-25',title:'A new look, and your whole client business in one place',highlights:[
    ['New design','A calmer, business-ready look: a black sidebar, warm Terracotta colours and clearer type across every page.'],
    ['Choose your action colour','Pick the highlight colour for your workspace in Settings → Appearance. Terracotta is the default.'],
    ['Jump back in','Home shows your three most recently edited clients, projects and TaskFlow quests, with revenue, what needs attention and today’s timeline.'],
    ['All work','See every project, client and completed piece of work as cards, newest first.'],
    ['Client and project notes','Keep notes, checklists and dated reminders on each client and project. Reminders also show on Home.'],
    ['Project pages','Every project now has its own page with tasks, notes and files.'],
    ['Files & docs','Write PRDs in SoloDesk, turn their requirements into tasks, and link files from Drive, OneDrive, Notion or Figma.'],
    ['Live Excel sync (coming soon)','Link a Microsoft Excel workbook to a project or client, with task edits flowing both ways and SoloDesk asking before it overwrites anything. The panel is in Files & docs and switches on in an upcoming update.'],
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
