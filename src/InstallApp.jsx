import {useId,useState,useSyncExternalStore} from 'react';
import {installController,installPlatform} from './install-controller';
import './install.css';

export default function InstallApp({compact=false,initialExpanded=false}) {
  const state=useSyncExternalStore(installController.subscribe,installController.getSnapshot);
  const [show,setShow]=useState(initialExpanded), [platform,setPlatform]=useState(()=>installPlatform(navigator));
  const id=useId();
  const add=()=>{setShow(true);if(state.canPrompt) void installController.prompt();};
  return <section className={'install-app '+(compact?'install-compact':'card')} aria-label="Add SoloDesk to your device">
    <div className="install-intro"><img src="/brand/solodesk-mark.svg" width="44" height="44" alt=""/><div><h3>{state.installed?'SoloDesk is ready on this device':'Keep your desk one tap away'}</h3><p>Open SoloDesk from your Home Screen, desktop or app launcher.</p></div></div>
    {!state.installed && <div className="install-actions"><button type="button" className="btn" aria-expanded={show} aria-controls={id} disabled={state.busy} onClick={add}>{state.busy?'Opening install…':'Add to Home Screen'}</button>{show && <button type="button" className="ghost" onClick={()=>setShow(false)}>Hide instructions</button>}</div>}
    <p role="status" className="install-status">{state.message || (state.installed ? 'You can keep using your existing Google account and workspace.' : '')}</p>
    {show && !state.installed && <div id={id} className="install-guide"><div className="install-platforms" role="group" aria-label="Choose your device">{[['ios','iPhone / iPad'],['android','Android'],['desktop','Desktop']].map(([value,label])=><button type="button" className="ghost sm" key={value} aria-pressed={platform===value} onClick={()=>setPlatform(value)}>{label}</button>)}</div>
      {platform==='ios' ? <><h4>iPhone or iPad</h4><ol><li>Open SoloDesk in <b>Safari</b>.</li><li>Tap <b>Share</b> (the square with an upward arrow). It may be inside the page menu.</li><li>Choose <b>Add to Home Screen</b>. If shown, keep <b>Open as Web App</b> enabled, then tap <b>Add</b>.</li></ol><p>iPhone and iPad use this browser menu rather than an automatic install pop-up.</p></> : platform==='android' ? <><h4>Android</h4><ol><li>Open SoloDesk in <b>Chrome</b>.</li><li>Use the install prompt when offered, or open the <b>⋮ menu → Add to Home screen</b> / <b>Install app</b>.</li><li>Confirm the name and tap <b>Install</b> or <b>Add</b>.</li></ol></> : <><h4>Desktop or laptop</h4><ol><li>In <b>Chrome or Edge</b>, use the install icon in the address bar or the browser menu’s app installation option.</li><li>On a supported Mac, open <b>Safari → File → Add to Dock</b>.</li><li>Confirm installation, then find SoloDesk in your app launcher or Dock. Your operating system may also offer a desktop shortcut or taskbar pin.</li></ol></>}
      <p className="form-help">If you’re viewing this inside another app, open the website in your usual browser first. Menu names vary by browser. You may need to sign in again in the installed app. An internet connection is needed to load and sync your workspace.</p>
    </div>}
  </section>;
}
