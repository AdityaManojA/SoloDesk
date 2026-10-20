export function installPlatform(navigator) {
  const ua=navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints>1)) return 'ios';
  return /Android/i.test(ua) ? 'android' : 'desktop';
}

export function createInstallController(win) {
  const listeners=new Set(), mode=win.matchMedia('(display-mode: standalone)');
  let deferred=null, installedEvent=false;
  let state={installed:mode.matches || win.navigator.standalone === true,canPrompt:false,busy:false,message:''};
  const update=patch=>{state={...state,...patch};listeners.forEach(listener=>listener());};
  const before=event=>{event.preventDefault();deferred=event;update({canPrompt:!state.installed,message:''});};
  const installed=()=>{deferred=null;installedEvent=true;update({installed:true,canPrompt:false,busy:false,message:'SoloDesk has been added. Open it from your Home Screen or app launcher.'});};
  const display=()=>update({installed:installedEvent || mode.matches || win.navigator.standalone === true});
  win.addEventListener('beforeinstallprompt',before);
  win.addEventListener('appinstalled',installed);
  mode.addEventListener?.('change',display);
  return {
    getSnapshot:()=>state,
    subscribe:listener=>{listeners.add(listener);return ()=>listeners.delete(listener);},
    async prompt(){
      if (!deferred || state.busy || state.installed) return false;
      const event=deferred;deferred=null;update({busy:true,canPrompt:false,message:''});
      try {
        await event.prompt();
        const choice=await event.userChoice;
        if (!state.installed) update({message:choice?.outcome === 'accepted' ? 'Installation requested. Finish the steps shown by your browser.' : 'Installation cancelled. You can still use SoloDesk here or follow the steps below later.'});
      } catch {if (!state.installed) update({message:'Your browser could not open the install prompt. Use the steps below instead.'});}
      finally {update({busy:false});}
      return true;
    },
    dispose(){win.removeEventListener('beforeinstallprompt',before);win.removeEventListener('appinstalled',installed);mode.removeEventListener?.('change',display);listeners.clear();},
  };
}

// Capture the browser event before navigating between login, Settings and More.
export const installController=typeof window === 'undefined' ? null : createInstallController(window);
