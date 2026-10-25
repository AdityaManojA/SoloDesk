// What the search box can jump to besides your work: every Settings option (by the words people use for it)
// and the pages that are no longer in the sidebar. `label` is the field to focus once the section is open.
const S = (title, section, keywords, label) => ({ kind: 'Settings', title, detail: { general: 'General', invoices: 'Invoices & bank', appearance: 'Appearance', data: 'Data & connections', 'whats-new': "What's new", account: 'Account' }[section], path: '#/settings/' + section, keywords, label });
const P = (title, page, keywords) => ({ kind: 'Page', title, detail: 'Open page', path: '#/' + page, keywords });

export const SETTINGS_INDEX = [
  S('Business name', 'general', 'company studio brand name invoice header', 'Business name'),
  S('Business email', 'general', 'email contact reply address meeting', 'Business email'),
  S('Phone', 'general', 'phone number mobile contact', 'Phone'),
  S('Business address', 'general', 'address location office', 'Address'),
  S('Logo', 'general', 'logo image brand picture upload invoice', 'Logo'),
  S('Default currency', 'general', 'currency money rupee inr usd dollar euro', 'Default currency'),
  S('Tax ID (GSTIN, VAT)', 'invoices', 'tax gst gstin vat id number', 'Tax ID'),
  S('Bank details', 'invoices', 'bank account number ifsc sort code swift bic iban upi payment', 'Account name'),
  S('Payment instructions', 'invoices', 'payment instructions terms how to pay invoice notes', 'Payment instructions'),
  S('Action colour', 'appearance', 'colour color accent highlight theme terracotta palette', ''),
  S('Light or dark mode', 'appearance', 'dark mode light mode night theme', ''),
  S('Home options', 'appearance', 'home dashboard jump back in needs attention calendar timeline hide show', ''),
  S('Data & connections', 'data', 'taskflow excel csv export import integrations api google calendar', ''),
  S('Offline access', 'data', 'offline cache no internet', ''),
  S('Onboarding & tour', 'data', 'onboarding tour welcome replay help getting started', ''),
  S('Install the app', 'data', 'install app home screen pwa desktop phone', ''),
  S("What's new", 'whats-new', 'whats new release notes version update changelog', ''),
  S('Sign out', 'account', 'sign out log out logout account', ''),
  S('Delete workspace', 'account', 'delete workspace account remove close', ''),
  P('Backup & restore', 'backups', 'backup restore export json download import'),
  P('Trash', 'trash', 'trash deleted bin restore recover'),
  P('Approvals', 'approvals', 'approvals approve requests client answers'),
  P('Calendar', 'calendar', 'calendar schedule month week day'),
  P('Daily planner', 'planner', 'planner plan day agenda'),
  P('Reports', 'reports', 'reports revenue income charts earnings'),
  P('Focus timer', 'focus', 'focus timer pomodoro time tracking'),
  P('Project templates', 'templates', 'templates project template'),
  P('Recurring invoice drafts', 'recurring', 'recurring invoices repeat drafts subscription retainer'),
  P('Profile', 'profile', 'profile public portfolio username'),
  P('Notes', 'notes', 'notes checklist'),
  P('All work', 'work', 'all work everything'),
];

// Every word typed must appear in the title or keywords; titles that start with the query rank first.
export function searchSettings(query) {
  const q = String(query || '').trim().toLowerCase(), terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return SETTINGS_INDEX.filter(x => terms.every(t => (x.title + ' ' + x.keywords).toLowerCase().includes(t)))
    .sort((a, b) => (b.title.toLowerCase().startsWith(q) - a.title.toLowerCase().startsWith(q)) || (a.kind === 'Settings' ? -1 : 1))
    .slice(0, 6);
}
