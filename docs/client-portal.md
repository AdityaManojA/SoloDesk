# Client portal setup

Sign in to SoloDesk as the workspace owner, open **Clients**, then open a client and choose **Access → Client portal**.

1. Enter the client's **email**. This is their username.
2. For a new account, enter an **initial password with at least 12 characters**. For someone who already uses this Firebase project, choose **Link existing account**; their current password is kept, and their email must be verified. Google sign-in is also available on the portal.
3. Select the **projects** and **sent invoices** they may see. Draft and void invoices are excluded.
4. Choose **Set up client access**. The owner stays signed in while Firebase creates the client's account through a separate, memory-only authentication instance.
5. Copy the **portal link** and share it, together with the initial password, privately. Open the link in a private browser window when testing as the client.

The client sees selected project names, dates, task progress/checklists and selected invoices. Private notes, contact details, other clients, focus history, TaskFlow records and business payment instructions are excluded. Published data is read-only for the client.

## Updates and account management

- Choose **Publish latest selected data** after changing project progress or invoices. The portal listens for published updates, but does not automatically publish private workspace edits.
- **Revoke portal access** removes the shared snapshot. It keeps the Firebase account, which may also be used in TaskFlow or other workspaces. Deleting a client revokes its portal share before removing the client; restoring the client does not restore portal access automatically. Workspace deletion removes its portal snapshots.
- Clients can use **Forgot password** on the sign-in page or **Change your password** after signing in. A recent sign-in may be required. Reset email delivery is handled by Firebase and depends on its email configuration, limits and spam filtering.
- Existing accounts are linked rather than overwritten. Owners cannot view or replace an existing account's password through this form.
- If Firebase account creation succeeds but publishing fails, the form keeps the new user ID while it remains open so publication can be retried. If you close it, use the existing-account flow after the client verifies the email, or contact support to repair the binding. The Auth account is not deleted automatically.
- No passwords are stored in SoloDesk workspace documents, portal snapshots or exported backups. The initial password exists only in the form and is cleared after the attempt. Never put passwords in client notes.

## Shared Firebase project

Email/password sign-in is enabled in `taskflow-dailytracker`; Google sign-in is retained. No Cloud Functions or billing upgrade is required for this portal. Shares live at `solodeskPortals/{ownerUid}/shares/{clientId}`. Firestore rules allow owner publishing and recipient reads, with verified-email checks when linking an existing account. The recipient cannot read the owner's `solodeskWorkspaces/{uid}` document.

The shared rules also preserve TaskFlow sync and its leaderboard. Keep the portal, workspace, TaskFlow and leaderboard rule blocks together in every future rules deployment. Both projects' local rule files are synchronized by this update.

The UI and Firebase rules were tested with synthetic accounts in local emulators; no real client accounts were created as part of testing. See [verification](../qa/workspace-upgrades-2026-10-20.md).
