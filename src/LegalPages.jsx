import { useState } from 'react';
import BrandLogo from './BrandLogo';
import './legal.css';

const operator = import.meta.env.VITE_POLICY_OPERATOR_NAME?.trim();
const email = import.meta.env.VITE_POLICY_CONTACT_EMAIL?.trim();

export function LegalLinks() {
  return <nav className="legal-links" aria-label="Policies"><a href="#/privacy">Privacy Policy</a><a href="#/cookies">Cookies & storage</a></nav>;
}

function Contact() {
  return <section id="contact"><h2>Contact</h2>{operator && <p>SoloDesk is operated by {operator}.</p>}{email ? <p>For privacy questions or a request concerning your data, email <a href={'mailto:' + email}>{email}</a>. Please identify your account without sending passwords, API keys or confidential client records.</p> : <p>The operator’s privacy contact has not been published yet. This page will be updated when contact details are available.</p>}</section>;
}

function Privacy() {
  return <>
    <p>SoloDesk helps you manage clients, projects, tasks, invoices and your work calendar. This policy describes the information used by the current application.</p>
    <section id="information"><h2>Information we use</h2><ul>
      <li><strong>Account information:</strong> when you sign in with Google through Firebase Authentication, SoloDesk uses your account identifier and available profile details, such as your name, email address and profile picture.</li>
      <li><strong>Workspace information:</strong> business settings, uploaded logos, client contact details and notes, projects, tasks, dates, invoices and payment records that you enter. SoloDesk records payment information you supply; it does not process payments or request payment card details.</li>
      <li><strong>Connection information:</strong> integration key names, permissions, owner identifiers, creation and expiry dates, revocation status and key hashes. A newly created secret is shown once.</li>
      <li><strong>Technical information:</strong> hosting and authentication providers may process information such as IP addresses, browser details and request logs to deliver and protect the service.</li>
    </ul><p>Only enter information you are authorized to use, including information about your clients.</p></section>
    <section id="purposes"><h2>How information is used</h2><p>Information is used to authenticate your account, save and display your workspace, calculate reports, generate documents and exports, and provide integrations you enable. The current application does not include advertising, advertising profiles or analytics trackers.</p></section>
    <section id="providers"><h2>Firebase, TaskFlow and other services</h2><p>SoloDesk uses Google Firebase for authentication and cloud storage. The configured Firebase project is shared with TaskFlow. SoloDesk workspace records are kept in a separate collection and associated with your Firebase user identifier. When you sign in, SoloDesk reads the TaskFlow share summary for your account to display open quests and any calendar events TaskFlow shares. This connection is read-only: SoloDesk does not modify TaskFlow records or read its compressed internal data. Quests can include notes, priorities, due times, repeat labels and subtasks. Calendar events can include titles, times, locations and source links. These records are displayed separately from SoloDesk workspace data.</p><p>Google handles your Google sign-in credentials. SoloDesk does not receive your Google password. See <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Firebase’s privacy information</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s Privacy Policy</a> for provider information. Processing locations and provider retention depend on the project configuration and provider policies.</p></section>
    <section id="sharing"><h2>Exports and integrations</h2><p>CSV, JSON and calendar downloads contain the data included in the export. After downloading or sharing a file, you control where it goes. An application holding an authorized integration key can read the data permitted by that key. Anyone with a private calendar subscription link can read its calendar feed; keep the link private.</p><p>You can revoke integration keys in Integrations. Revocation stops future access through that key, but does not remove copies already downloaded or cached by another application. Direct Google Calendar and Apple Calendar account syncing is not currently enabled.</p></section>
    <section id="retention"><h2>Storage and retention</h2><p>Signed-in workspace information is stored in Firestore until you remove it or delete your SoloDesk workspace. Demo workspace data stays in this browser and is not saved as a real workspace in Firestore. Theme preferences and authentication state also use browser storage; see the <a href="#/cookies">Cookies & storage page</a>.</p><p>Deleting your SoloDesk workspace removes its active workspace document. It keeps the shared Firebase sign-in account and does not delete TaskFlow data, integration-key metadata, exported files or copies held by other applications. Revoke integration keys separately. Provider logs and any configured backups have separate retention arrangements; deletion from the active workspace does not promise immediate removal from those systems.</p></section>
    <section id="choices"><h2>Your controls</h2><p>You can edit your records, export workspace data, revoke integration keys, sign out, clear local demo data and delete your SoloDesk workspace through the application. Sign out before clearing authentication storage on a shared device. Requests about the shared account or other retained records require contacting the operator.</p></section>
    <section id="changes"><h2>Changes to this policy</h2><p>This page will be updated when the application’s data practices change. The date above identifies this version.</p></section>
    <Contact />
  </>;
}

function Cookies() {
  const [message, setMessage] = useState('');
  const clearDemo = () => {
    try {
      localStorage.removeItem('sd_demo');
      sessionStorage.removeItem('sd_demo_active');
      window.location.assign('/cookies?demoCleared=1');
    } catch { setMessage('Browser storage could not be cleared. You can clear this website’s data in your browser settings.'); }
  };
  return <>
    <p>This page covers cookies and similar browser storage, including local storage, session storage and IndexedDB. SoloDesk uses browser storage for its theme, local demo and sign-in session.</p>
    <section><h2>What is stored</h2><div className="legal-table-wrap" tabIndex={0} role="region" aria-label="Storage details, scroll horizontally on small screens"><table><caption>Storage used by the current application</caption><thead><tr><th scope="col">Storage</th><th scope="col">Purpose</th><th scope="col">Duration</th></tr></thead><tbody>
      <tr><th scope="row">sd_theme<br /><small>Local storage</small></th><td>Remembers your light or dark theme.</td><td>Until changed or cleared in this browser.</td></tr>
      <tr><th scope="row">sd_install_notice_v1<br /><small>Local storage</small></th><td>Remembers that the one-time installation suggestion has been shown on this browser.</td><td>Until website storage is cleared.</td></tr>
      <tr><th scope="row">sd_onboarding_v1:*<br /><small>Local storage</small></th><td>Remembers completed or skipped onboarding for each account or the local demo. Settings and More let you replay onboarding and the tour.</td><td>Until website storage is cleared.</td></tr>
      <tr><th scope="row">sd_demo<br /><small>Local storage</small></th><td>Keeps the demo workspace and edits made in demo mode on this device.</td><td>Until demo data or website storage is cleared. Signing out of the demo alone does not erase it.</td></tr>
      <tr><th scope="row">sd_demo_active<br /><small>Session storage</small></th><td>Remembers that this tab is using the local demo.</td><td>Until you exit demo mode, clear it or the browser ends the tab session; browser session restoration may preserve it.</td></tr>
      <tr><th scope="row">Firebase Authentication<br /><small>SDK-managed browser storage</small></th><td>Maintains your sign-in state. Firebase may use IndexedDB or other supported storage; names vary by SDK and app configuration.</td><td>The configured default is persistent sign-in on this origin until sign-out or local authentication data is cleared.</td></tr>
      <tr><th scope="row">Google sign-in<br /><small>Provider-managed storage</small></th><td>Google may use cookies or other storage on its own sign-in domains when you authenticate.</td><td>Controlled by Google and your browser/account settings.</td></tr>
    </tbody></table></div></section>
    <section><h2>Advertising and analytics</h2><p>The current SoloDesk application does not include advertising cookies or analytics trackers. There are no optional advertising or analytics categories to enable on this page. If these features are introduced, this policy and any applicable choices must be updated before they are used.</p></section>
    <section><h2>Manage storage</h2><p>You can change your theme using the app’s theme control and end your sign-in session using Sign out. Your browser’s site settings let you inspect or delete cookies and other website data. Blocking storage may prevent sign-in, preferences or demo mode from working correctly.</p><p>Clearing local storage does not delete your cloud workspace. Clearing demo data removes local demo edits and exits demo mode; your theme, real workspace and shared TaskFlow account are kept.</p><button className="ghost" onClick={clearDemo}>Clear local demo data</button><p role="status">{message || (new URLSearchParams(window.location.search).has('demoCleared') ? 'Local demo data has been cleared.' : '')}</p></section>
    <section><h2>Learn more</h2><p>Read the <a href="#/privacy">Privacy Policy</a> for details about workspace records, integrations and deletion. Google explains its use of cookies in its <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">cookies information</a>.</p></section>
    <Contact />
  </>;
}

export default function LegalPage({ page, mainRef }) {
  const privacy = page === 'privacy';
  return <div className="legal-layout"><header className="legal-header"><a className="wordmark" href="#/dash"><BrandLogo /></a><a className="ghost" href="#/dash">Back to SoloDesk</a></header><main ref={mainRef} id="workspace" tabIndex={-1} className="legal-main"><article className="card legal-article"><span className="eyebrow">YOUR DATA & YOUR CHOICES</span><h1>{privacy ? 'Privacy Policy' : 'Cookies & storage'}</h1><p className="mu">Last updated: 19 October 2026</p>{privacy ? <Privacy /> : <Cookies />}</article><footer className="legal-footer"><span>SoloDesk</span><LegalLinks /></footer></main></div>;
}
