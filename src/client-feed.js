// What clients do in their portal, as it reaches Terracove: comments on tasks (including quick "You got this"
// cheers and change requests) and link updates. Plain functions here; the Firestore listeners are in portal-sync.js.
import { clientLinkUrl, MAX_CLIENT_LINKS } from './invoice-input.js';
import { rid } from './lib.js';

export const COMMENT_KINDS = { comment: 'Comment', cheer: 'Cheer', change: 'Change request' };
export const CHEER = 'You got this! 💪';
// Client requests ("Can you also add a blog?") and the replies you can send back. "custom" carries your own timing.
export const REPLIES = { scope: 'Feature scope', now: 'We’ll start right away', can: 'Can be implemented', progress: 'In progress', custom: 'Custom timing' };
export const REPLY_TONE = { scope: 'sand', now: 'sage', can: 'white', progress: 'hero', custom: 'ink' };
export const replyLabel = r => r?.reply ? (r.reply === 'custom' ? r.replyText || REPLIES.custom : REPLIES[r.reply]) : 'Waiting for a reply';

// A link or file update from the client. Returns the activity row to record, or null when nothing changed.
export function applyClientUpdate(workspace, clientId, update, now = new Date().toISOString()) {
  const client = workspace.clients.find(c => c.id === clientId);
  if (!client || !update) return null;
  if (update.kind === 'brief') {
    const doc = (workspace.docs || []).find(x => x.id === update.docId && x.kind === 'brief' && (x.client === clientId || workspace.projects.some(p => p.id === x.project && p.client === clientId)));
    if (!doc) return null;
    if (Array.isArray(update.questions)) {
      doc.questions = update.questions;
    }
    doc.submittedAt = now;
    doc.updatedAt = now;
    return { id: rid(), at: now, kind: 'docs', recordId: doc.id, client: clientId, title: doc.title, action: 'client-submitted-brief' };
  }
  const url = clientLinkUrl(update?.url);
  if (!url) return null;
  const label = String(update.label || '').trim().slice(0, 60);
  if (update.kind === 'file') {
    const doc = (workspace.docs || []).find(x => x.id === update.docId && x.kind === 'link' && (x.client === clientId || workspace.projects.some(p => p.id === x.project && p.client === clientId)));
    if (!doc || doc.url === url) return null;
    doc.url = url; if (label) doc.title = label; doc.updatedAt = now;
    return { id: rid(), at: now, kind: 'docs', recordId: doc.id, client: clientId, title: doc.title, action: 'client-updated-file' };
  }
  const links = client.links || (client.links = []);
  const old = update.replaceUrl ? links.find(l => l.url === update.replaceUrl) : null;
  if (old) { if (old.url === url && old.label === label) return null; old.url = url; old.label = label; }
  else { if (links.some(l => l.url === url) || links.length >= MAX_CLIENT_LINKS) return null; links.push({ label, url }); }
  return { id: rid(), at: now, kind: 'clients', recordId: clientId, client: clientId, title: label || url, action: old ? 'client-updated-link' : 'client-added-link' };
}

// The draft email for "Request a meeting" in the portal.
function meetingDraft({ business, clientName, project }) {
  return { subject: `Meeting request${project ? ' · ' + project : ''}`, body: `Hi ${business || 'there'},\n\nCan we have a meeting / quick call?\n\nWhat about: \nTimes that work for me: \n\nThanks,\n${clientName || ''}` };
}
// Opens a new Gmail message in the browser, addressed and filled in.
export function meetingGmail(to, info) {
  const { subject, body } = meetingDraft(info);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export function meetingMailto(to, { business, clientName, project }) {
  const subject = `Meeting request${project ? ' · ' + project : ''}`;
  const body = `Hi ${business || 'there'},\n\nCan we have a meeting / quick call?\n\nWhat about: \nTimes that work for me: \n\nThanks,\n${clientName || ''}`;
  return `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
