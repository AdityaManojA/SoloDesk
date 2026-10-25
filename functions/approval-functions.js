// Approval emails (needs the Blaze plan and the Trigger Email extension; see docs/approval-emails-setup.md).
// - When you send something for approval, the client gets an email with a link to their portal.
// - When the client answers, you get an email. SoloDesk copies the answer onto the item the next time it opens.
// Deploy with: firebase deploy --only functions:approvals
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { newlyRequested, shareItems, requestEmail, answerEmail } from './approval-mail.js';

const APP_URL = defineString('SOLODESK_URL', { default: 'https://taskflow-solodesk.web.app', description: 'Where SoloDesk is hosted, used for links in approval emails.' });
const MAIL = defineString('MAIL_COLLECTION', { default: 'mail', description: 'Collection the Trigger Email extension watches.' });

export const onShareWrite = onDocumentWritten('solodeskPortals/{owner}/shares/{client}', async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null, after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after?.recipientEmail) return;
  const items = newlyRequested(before?.data, after.data);
  if (!items.length) return;
  await getFirestore().collection(MAIL.value()).add(requestEmail({ to: after.recipientEmail, business: after.data.business, clientName: after.data.clientName, items, portalUrl: `${APP_URL.value()}/#/portal/${event.params.owner}` }));
  logger.info('Approval request emailed', { owner: event.params.owner, client: event.params.client, items: items.length });
});

export const onApprovalAnswer = onDocumentWritten('solodeskPortals/{owner}/shares/{client}/responses/{item}', async event => {
  const answer = event.data?.after?.exists ? event.data.after.data() : null;
  if (!answer) return;
  const { owner, client, item } = event.params, db = getFirestore();
  const share = (await db.doc(`solodeskPortals/${owner}/shares/${client}`).get()).data();
  const found = shareItems(share?.data).find(x => x.id === item);
  const user = await getAuth().getUser(owner).catch(() => null);
  if (!user?.email) return;
  await db.collection(MAIL.value()).add(answerEmail({ to: user.email, clientName: share?.data?.clientName || answer.email, item: found, decision: answer.decision, comment: answer.comment, appUrl: APP_URL.value() }));
});
