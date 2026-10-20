const paths = {
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
  dash: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  projects: 'M3 7h7l2-3h9v16H3z M3 10h18',
  tasks: 'M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',
  invoices: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7',
  reports: 'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  integrations: 'M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-6 6v4 M6 8v3a6 6 0 0 0 6 6',
  arrow: 'M5 12h14 M13 6l6 6-6 6', plus: 'M12 5v14 M5 12h14',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',
  close: 'M6 6l12 12 M6 18L18 6', search: 'M21 21l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
  check: 'M5 12l4 4L19 6', logout: 'M9 3H4v18h5 M9 12h12 M16 7l5 5-5 5', more: 'M5 5h14 M5 12h14 M5 19h14',
};
export default function Icon({ name, size = 20, ...props }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.dash} /></svg>;
}
