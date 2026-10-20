# Deletion and sign-out

- 39 automated tests passed; build passed.
- New deletion tests cover preserving/unlinking project tasks, cascading only a client's linked records, deleting invoices with embedded payments, payment scope with duplicate payment IDs, financial recalculation and missing-record no-ops.
- Browser: Projects exposes red delete buttons; confirmation names the project and explains task preservation. Cancel returns to the unchanged project list.
- Browser: Settings and header expose sign-out; clicking Settings sign-out in demo returned to `/`, titled Sign in · SoloDesk, showing Continue with Google.
- Destructive confirmation was not clicked against existing browser or cloud records. No real-account deletion or sign-out test is claimed.
- Hosting deployment targets only SoloDesk. Shared Firestore rules and function codebases stay intact.
