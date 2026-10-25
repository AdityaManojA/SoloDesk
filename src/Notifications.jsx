import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { buildNotifications, unreadCount } from './notifications';

const ICON = { request: 'plus', approved: 'approve', changes: 'notes', cheer: 'check', comment: 'notes', link: 'link', overdue: 'invoices', reminder: 'bell', due: 'tasks' };
const TONE = { request: 'hero', approved: 'sage', changes: 'sand', cheer: 'sage', comment: 'hero', link: 'white', overdue: 'hero', reminder: 'sand', due: 'white' };
const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

// The bell in the top bar: approvals answered, client comments and link updates, overdue invoices, reminders
// and tasks due today. Opening it marks everything as seen (saved with the workspace, so on every device).
export function NotificationBell({ d, mut, comments, requests = [] }) {
  const [open, setOpen] = useState(false), ref = useRef(null);
  const list = useMemo(() => buildNotifications(d, comments, new Date(), requests), [d, comments, requests]);
  const seen = d.settings.notificationsSeenAt || '', unread = unreadCount(list, seen);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); }, key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const markSeen = () => { if (unread) mut(n => { n.settings.notificationsSeenAt = new Date().toISOString(); }); };
  return <span className="notif-wrap" ref={ref}>
    <button type="button" className="icon-button notif-button" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} aria-expanded={open} title="Notifications" onClick={() => { setOpen(!open); }}><Icon name="bell" size={18} />{unread > 0 && <span className="notif-count">{unread > 9 ? '9+' : unread}</span>}</button>
    {open && <div className="notif-panel" role="dialog" aria-label="Notifications">
      <div className="notif-head"><b>Notifications</b>{unread > 0 && <button type="button" className="ghost sm" onClick={markSeen}>Mark all as read</button>}</div>
      {list.length ? <ul>{list.map(n => <li key={n.id}><a href={n.href} className={'notif-item' + (!seen || n.at > seen ? ' new' : '')} onClick={() => { setOpen(false); markSeen(); }}><span className={'dot-icon ' + TONE[n.kind]}><Icon name={ICON[n.kind] || 'bell'} size={16} /></span><span className="grow"><b>{n.title}</b>{n.detail && <small>{n.detail}</small>}<small className="notif-time">{['due', 'reminder'].includes(n.kind) ? 'Today' : n.kind === 'overdue' ? 'Due ' + new Date(n.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ago(n.at)}</small></span></a></li>)}</ul>
        : <p className="empty-note" style={{ margin: 0, padding: '12px 4px' }}>You’re all caught up. Client answers, comments and anything due show up here.</p>}
    </div>}
  </span>;
}
