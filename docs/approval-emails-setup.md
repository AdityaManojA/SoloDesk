# Approval emails

When you send a task, PRD, file or quote for approval, Terracove can email the client a link to their portal. When they approve or ask for changes, it can email you. The code is in [`functions/approval-functions.js`](../functions/approval-functions.js) (triggers) and [`functions/approval-mail.js`](../functions/approval-mail.js) (the emails). It needs the **Blaze** plan.

Without these functions everything still works: the client sees the request in their portal, and their answer is copied onto the item the next time you open Terracove (the answer waits in `solodeskPortals/{owner}/shares/{client}/responses`).

## Set up (once, after moving to Blaze)

1. Install the **Trigger Email from Firestore** extension in project `taskflow-dailytracker`:
   ```
   firebase ext:install firebase/firestore-send-email --project taskflow-dailytracker
   ```
   Use collection `mail`, and SMTP details from your email provider (for example SendGrid, Postmark, Mailgun or a Google Workspace app password). Set the default FROM address to the address clients should see.
2. Deploy the approval functions:
   ```
   firebase deploy --only functions:approvals --project taskflow-dailytracker --account aditya.dev.org@gmail.com
   ```
   Parameters (asked on first deploy): `SOLODESK_URL` (default `https://taskflow-solodesk.web.app`) and `MAIL_COLLECTION` (default `mail`).
3. The `mail` collection is written by the functions only. Firestore rules deny client access by default, so no rules change is needed.

## What gets sent

- **To the client**, when a share is published with items that are newly waiting for approval (or sent again): subject "Studio would like your approval on …", the items and your message, and an **Open your portal** button.
- **To you** (the email on your Terracove sign-in), when the client answers: "Ava approved “Homepage”" or "asked for changes to", with their comment and an **Open Approvals** button.
