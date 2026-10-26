# Live Microsoft Excel sync — setup

Links a Microsoft Excel workbook (OneDrive or SharePoint) to one Terracove project or client. Task name, status, due date and priority sync both ways; logged hours go from Terracove to the sheet. Each row carries a **Terracove ID** column so rows match even after reordering. If the same cell changed in both places, Terracove keeps both and asks which to use. Rows are never deleted on either side.

How it runs (code in `functions/excel-*.js`, client in `src/excel-sync-client.js`):

- Microsoft sign-in uses the authorization-code flow with PKCE. The refresh token is encrypted (AES-256-GCM) and stored in `solodeskPrivate/{uid}`, which browsers cannot read.
- Sheet → Terracove: Microsoft notifies `excel-webhook` when a linked drive changes; the server reads the sheet and leaves the changes in `solodeskSync/{uid}/inbox`. The open app applies them as normal edits and clears each entry once saved. The server never rewrites the workspace itself.
- Terracove → sheet: every workspace save triggers `excel-onWorkspaceWrite`; it skips the Excel round trip when the linked tasks did not change, and otherwise writes only the changed cells (formulas and other columns are untouched).
- `excel-maintain` runs hourly to renew Microsoft notifications and as a backstop sync.

## What you need to do (once)

1. **Upgrade the Firebase project to Blaze.** `taskflow-dailytracker` is shared with Levern, so billing covers both apps. Set a budget alert in Google Cloud Billing. Expected use is small (a function call per save and per sheet change).
2. **Register an app with Microsoft** at entra.microsoft.com → App registrations → New registration:
   - Name: Terracove. Supported accounts: *any organizational directory and personal Microsoft accounts*.
   - Redirect URI (Web): `https://us-central1-taskflow-dailytracker.cloudfunctions.net/excel-oauthCallback`
   - API permissions → Microsoft Graph → Delegated: `offline_access`, `User.Read`, `Files.ReadWrite.All`.
   - Certificates & secrets → New client secret. Copy its **Value**.
3. **Store the secrets** (from the repo root):
   ```bash
   firebase functions:secrets:set MS_CLIENT_SECRET --project taskflow-dailytracker
   ```
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   ```bash
   firebase functions:secrets:set MS_TOKEN_KEY --project taskflow-dailytracker
   ```
   Paste the client secret for the first, and the generated value for the second. Losing `MS_TOKEN_KEY` only means people reconnect Microsoft.
4. **Create `functions/.env.taskflow-dailytracker`:**
   ```
   MS_CLIENT_ID=<Application (client) ID>
   MS_TENANT=common
   SOLODESK_APP_URL=https://terracove.web.app
   MS_REDIRECT_URI=https://us-central1-taskflow-dailytracker.cloudfunctions.net/excel-oauthCallback
   MS_WEBHOOK_URL=https://us-central1-taskflow-dailytracker.cloudfunctions.net/excel-webhook
   ```
5. **Deploy, in this order:**
   - Firestore rules — copy `firestore.rules` to Levern's copy first so both stay identical, then `firebase deploy --only firestore:rules --project taskflow-dailytracker`.
   - Functions — only the Excel group: `firebase deploy --only functions:excel --project taskflow-dailytracker`.
   - Hosting — add `VITE_EXCEL_SYNC=on` to `.env.local` (until then the panel shows "Coming soon"), run `npm run build`, then `firebase deploy --only hosting:solodesk --project taskflow-dailytracker`.

The in-app screens (connect Microsoft, link a workbook, sync status, conflicts, column mapping) are in every client's and project's **Files & docs** tab. They show "Coming soon" until `VITE_EXCEL_SYNC=on` is set at build time.
