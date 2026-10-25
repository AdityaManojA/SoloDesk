// Approval emails, written as documents for the "Trigger Email from Firestore" extension (collection `mail`).
// Plain functions, so they can be tested without Firebase.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND = { task: 'task', prd: 'PRD', link: 'file', quote: 'quote' };

// Everything that can be approved in a published share: tasks with an approval plus PRDs, files and quotes.
export const shareItems = data => [...(data?.tasks || []).filter(t => t.approval).map(t => ({ ...t, kind: 'task' })), ...(data?.approvals || [])];

// Items that became "waiting for approval" in this write (new, or sent again).
export function newlyRequested(before, after) {
  const old = new Map(shareItems(before).map(x => [x.id, x.approval?.requestedAt]));
  return shareItems(after).filter(x => x.approval?.state === 'pending' && old.get(x.id) !== x.approval.requestedAt);
}

const button = (url, label) => `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#141414;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(label)}</a></p>`;
const wrap = body => `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#141414;max-width:560px">${body}<p style="color:#7a756c;font-size:12px;margin-top:32px">Sent by SoloDesk.</p></div>`;

export function requestEmail({ to, business, clientName, items, portalUrl }) {
  const list = items.map(x => `<li><b>${esc(x.title)}</b> <span style="color:#7a756c">(${KIND[x.kind] || 'item'})</span>${x.approval?.note ? `<br><i>“${esc(x.approval.note)}”</i>` : ''}</li>`).join('');
  const what = items.length === 1 ? `“${items[0].title}”` : `${items.length} items`;
  return { to, message: {
    subject: `${business} would like your approval on ${what}`,
    text: `Hi ${clientName},\n\n${business} sent you ${what} to approve:\n${items.map(x => '- ' + x.title + (x.approval?.note ? ' — ' + x.approval.note : '')).join('\n')}\n\nApprove or ask for changes in your portal: ${portalUrl}`,
    html: wrap(`<p>Hi ${esc(clientName)},</p><p>${esc(business)} sent you ${esc(what)} to approve:</p><ul>${list}</ul>${button(portalUrl, 'Open your portal')}`),
  } };
}

export function answerEmail({ to, clientName, item, decision, comment, appUrl }) {
  const verb = decision === 'approved' ? (item?.kind === 'quote' ? 'accepted' : 'approved') : 'asked for changes to';
  const title = item?.title || 'an item';
  return { to, message: {
    subject: `${clientName} ${verb} “${title}”`,
    text: `${clientName} ${verb} “${title}”.${comment ? `\n\n“${comment}”` : ''}\n\nOpen SoloDesk to see it: ${appUrl}/#/approvals`,
    html: wrap(`<p><b>${esc(clientName)}</b> ${esc(verb)} <b>“${esc(title)}”</b>.</p>${comment ? `<p style="padding:12px 16px;background:#f3ecdf;border-radius:14px"><i>“${esc(comment)}”</i></p>` : ''}${button(appUrl + '/#/approvals', 'Open Approvals')}`),
  } };
}
