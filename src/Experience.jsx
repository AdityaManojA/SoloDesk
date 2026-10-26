import {BrandMark} from './BrandLogo';
import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import InstallApp from './InstallApp';
import {installController} from './install-controller';
import {installNoticeKey,rememberSeen,wasSeen,tourSteps} from './experience-state';
import {tourHighlight,placeTourCard} from './tour-geometry';
import './experience.css';

function Dialog({children,onClose,label,cardClass='',footer,cardStyle,onMeasure}){
  const ref=useRef(null),close=useRef(onClose),previousFocus=useRef(document.activeElement),id=useId();close.current=onClose;
  const [viewport,setViewport]=useState(null);
  useEffect(()=>{
    if(!onMeasure||!ref.current)return;
    const observer=new ResizeObserver(()=>onMeasure(ref.current.getBoundingClientRect().height));
    observer.observe(ref.current);return()=>observer.disconnect();
  },[onMeasure]);
  useEffect(()=>{
    const visual=window.visualViewport;
    const resize=()=>setViewport({top:visual?.offsetTop||0,left:visual?.offsetLeft||0,width:visual?.width||window.innerWidth,height:visual?.height||window.innerHeight});
    resize();visual?.addEventListener('resize',resize);visual?.addEventListener('scroll',resize);window.addEventListener('resize',resize);
    return()=>{visual?.removeEventListener('resize',resize);visual?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);};
  },[]);
  useEffect(()=>{if(ref.current){ref.current.querySelector('.experience-body').scrollTop=0;ref.current.focus({preventScroll:true});}},[label]);
  useEffect(()=>{
    const previous=previousFocus.current,root=document.getElementById('root'),inert=root?.inert,overflow=document.body.style.overflow;
    if(root)root.inert=true;
    document.body.style.overflow='hidden';ref.current?.focus({preventScroll:true});
    const keys=event=>{
      if(event.key==='Escape'){event.preventDefault();close.current();}
      if(event.key!=='Tab')return;
      const stops=[...ref.current.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length);
      if(!stops.length){event.preventDefault();return;}
      const first=stops[0],last=stops.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keys);
    return()=>{document.removeEventListener('keydown',keys);document.body.style.overflow=overflow;if(root)root.inert=inert;requestAnimationFrame(()=>previous?.isConnected?previous.focus():document.getElementById('workspace')?.focus());};
  },[]);
  return createPortal(<div className={'experience-layer '+cardClass} style={viewport}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className="experience-card" style={cardStyle}>
      <div className="experience-title"><h2 id={id}>{label}</h2><button type="button" className="icon-button" aria-label="Close introduction" onClick={onClose}>×</button></div><div className="experience-body">{children}</div>{footer}
    </section>
  </div>,document.body);
}

export function InstallNotice(){
  const install=useSyncExternalStore(installController.subscribe,installController.getSnapshot),installed=install.installed;
  const [visible,setVisible]=useState(()=>!wasSeen(localStorage,installNoticeKey)),[open,setOpen]=useState(false);
  useEffect(()=>{if(visible&&!installed)rememberSeen(localStorage,installNoticeKey);},[visible,installed]);
  if(installed)return null;
  return <>{visible&&<aside className="install-notice" aria-label="Install Terracove"><span><b>Your desk, one tap away.</b> Add Terracove to your Home Screen or desktop.</span><div><button type="button" className="btn sm" onClick={()=>{if(install.canPrompt)void installController.prompt();setOpen(true);setVisible(false);}}>Add to Home Screen</button><button type="button" className="icon-button" aria-label="Dismiss install suggestion" onClick={()=>setVisible(false)}>×</button></div></aside>}
    {open&&<Dialog label="Add Terracove to your device" onClose={()=>setOpen(false)}><InstallApp compact initialExpanded/><button type="button" className="ghost" onClick={()=>setOpen(false)}>Done</button></Dialog>}
  </>;
}

function BoldCopy({text}){
  return text.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part);
}

// Small, illustrative screens in the Terracotta style. They show the real layout, not live data.
const SWATCHES=['#E8957A','#E5B94E','#A7B98B','#86B8B1','#9DC3E0','#B8A9DC','#C9BBA6'];
function MiniPreview({kind,compact=false}){
  return <figure className={'ob-preview'+(compact?' compact':'')} aria-label="Illustrative screen example"><figcaption><span>TERRACOVE</span><span>Example</span></figcaption>
    {kind==='home'&&<div className="ob-home"><small className="ob-eyebrow">JUMP BACK IN</small><div className="ob-tiles"><div className="ob-tile hero"><small>PROJECT</small><b>Website launch</b><span>Edited 2 min ago</span></div><div className="ob-tile sand"><small>NOTE</small><b>Kick-off call</b><span>☑ Send brief</span></div><div className="ob-tile sage"><small>CLIENT</small><b>Ava Studio</b><span>3 projects</span></div></div><div className="ob-compose">Take a note…<span className="ob-pill">TaskFlow · 2 quests</span></div></div>}
    {kind==='notes'&&<div className="ob-notes"><aside><b>Notes</b><span className="on">Kick-off call</span><span>Brand ideas</span><span>Invoice list</span></aside><div><b>Kick-off call</b><ul><li className="done"><i/>Send the brief</li><li><i/>Plan the homepage</li><li className="sub"><i/>Hero copy</li><li className="sub"><i/>Photos <em>Fri</em></li></ul><small>Enter adds a line · Tab nests it</small></div></div>}
    {kind==='calendar'&&<div className="ob-cal"><div className="ob-cal-bar"><span className="ob-seg"><b>Month</b><span>Week</span><span>Day</span></span><span className="ob-zoom">－ ＋</span></div><div className="ob-month">{['free','light','busy','packed','light','free','free','busy','light','free','packed','busy','light','free'].map((l,i)=><span key={i} style={{gridColumn:i%7+1,gridRow:Math.floor(i/7)+1}} className={'ob-day load-'+l+(i===3?' today':'')}><b>{i+19>31?i-12:i+19}</b></span>)}<span className="ob-bar" style={{gridColumn:'2 / span 5',gridRow:1}}>Website launch</span><span className="ob-bar sage" style={{gridColumn:'4 / span 4',gridRow:2}}>Ava retainer · ongoing</span></div><div className="ob-legend"><span><i className="load-free"/>Free</span><span><i className="load-light"/>Light</span><span><i className="load-busy"/>Busy</span><span><i className="load-packed"/>Packed</span></div></div>}
    {(kind==='workflow'||kind==='clients'||kind==='projects')&&<div className="ob-flow"><div className="ob-row"><span className="ob-avatar">AS</span><span><small>CLIENT</small><b>Ava Studio</b></span></div><span className="ob-arrow">↓</span><div className="ob-row hero"><span><small>PROJECT</small><b>Website launch</b></span><span className="ob-chip">Oct 19 → ongoing</span></div>{kind!=='clients'&&<><span className="ob-arrow">↓</span><div className="ob-row"><i className="ob-check"/><span>Review homepage</span><span className="ob-chip sand">Tomorrow</span></div></>}</div>}
    {kind==='invoices'&&<div className="ob-invoice"><div className="ob-row"><span><small>INVOICE</small><b>INV-0007</b></span><span className="ob-chip sage">Paid</span></div><div className="ob-lines"><span>Website design</span><b>₹12,000</b><span>Bank · HDFC ···4821</span><span>Edit anything</span></div><div className="ob-steps"><span>Draft</span>→<span>Sent</span>→<b>Paid</b></div></div>}
    {kind==='profile'&&<div className="ob-profile"><span className="ob-avatar lg">MR</span><div><b>Maya Rao</b><small>Brand & web designer</small><span className="ob-url">terracove · <b>maya</b></span><div className="ob-links"><span>Portfolio</span><span>LinkedIn</span><span>Dribbble</span></div></div><span className="ob-chip">Private until you share it</span></div>}
    {(kind==='colours'||kind==='settings')&&<div className="ob-colours"><small className="ob-eyebrow">ACTION COLOUR</small><div className="ob-swatches">{SWATCHES.map((c,i)=><i key={c} style={{background:c}} className={i===0?'on':''}/>)}<i className="custom"/></div><div className="ob-tile hero"><small>FEATURED</small><b>Your colour, everywhere</b></div><span className="ob-black">Buttons stay black</span></div>}
    {kind==='install'&&<div className="ob-device"><span className="ob-app"><BrandMark size={40}/><b>Terracove</b></span><div><b>Your desk, one tap away</b><span className="ob-black">Add to Home Screen</span><small>Desktop · iPhone / iPad · Android</small></div></div>}
  </figure>;
}

const welcomeSteps=[
  {nav:'Home',title:'Pick up where you left off',preview:'home',text:'**Jump back in** shows your **three latest edits**: notes, projects, clients and tasks. Edit them **right on Home**, or **take a note** in one tap.'},
  {nav:'Notes',title:'Notes that think like lists',preview:'notes',text:'Turn any note into a **checklist**. **Enter** adds a line, **Tab** makes a **subtask**, and each item can get a **reminder**. No pop-ups.'},
  {nav:'Clients',title:'Client → project → task',preview:'workflow',text:'Add a **client**, give them a **project** with a start date (**no end date = ongoing**), then add the next **task**.'},
  {nav:'Calendar',title:'See how full each day is',preview:'calendar',text:'**Zoom** from **year** to **day**. Projects span **every day** they run, and colours show which days are **free**, **busy** or **packed**.'},
  {nav:'Profile',title:'A page for your work',preview:'profile',text:'Set up a **public profile** at **your own link** with your links. It stays **private** until you switch it on.'},
  {nav:'Make it yours',title:'Make this desk yours',preview:'colours',text:'Choose an **action colour** (or any **custom** one) in **Settings → Appearance**, then **install** Terracove or take the **guided tour**.'},
];

function Onboarding({onClose,onTour,demo}){
  const [step,setStep]=useState(0),content=welcomeSteps[step],last=step===welcomeSteps.length-1;
  return <Dialog label={content.title} cardClass="ob-layer" onClose={onClose} footer={<div className="experience-actions"><button type="button" className="ghost" onClick={step?()=>setStep(step-1):onClose}>{step?'Back':'Skip'}</button><span className="ob-dots" aria-hidden="true">{welcomeSteps.map((_,i)=><i key={i} className={i===step?'on':''}/>)}</span>{last?<><button type="button" className="ghost" onClick={onClose}>Go to workspace</button><button type="button" className="btn" onClick={onTour}>Start guided tour</button></>:<button type="button" className="btn" onClick={()=>setStep(step+1)}>Next</button>}</div>}>
    <p className="experience-progress" aria-live="polite">WELCOME TO TERRACOVE · {step+1} / {welcomeSteps.length}</p>
    <nav className="experience-steps ob-steps" aria-label="Onboarding steps">{welcomeSteps.map((x,index)=><button type="button" key={x.nav} aria-label={'Step '+(index+1)+': '+x.nav} aria-current={index===step?'step':undefined} onClick={()=>setStep(index)}><span>{index+1}</span>{x.nav}</button>)}</nav>
    <MiniPreview kind={content.preview}/>
    <p className="experience-description"><BoldCopy text={content.text}/></p>
    {step===0&&<div className="experience-note">{demo?<><strong>Demo mode:</strong> sample data; edits stay in this browser.</>:<><strong>Your Google account</strong> keeps your workspace in sync.</>}</div>}
    {last&&<InstallApp compact/>}
  </Dialog>;
}

function Tour({onClose}){
  const maskId='tour-mask-'+useId().replace(/:/g,'');
  const [index,setIndex]=useState(0),[rect,setRect]=useState(null),original=useRef(window.location.hash),step=tourSteps[index];
  const [cardHeight,setCardHeight]=useState(480),[view,setView]=useState({left:0,top:0,width:window.innerWidth,height:window.innerHeight});
  const exit=()=>{window.location.hash=original.current||'#/dash';onClose();};
  useEffect(()=>{
    let frame,attempt=0,element,observer,tracking;
    setRect(null);window.location.hash='#/'+step.page;
    const measure=()=>{
      if(!element?.isConnected)return;
      const visual=window.visualViewport,viewport={left:visual?.offsetLeft||0,top:visual?.offsetTop||0,width:visual?.width||window.innerWidth,height:visual?.height||window.innerHeight};
      setView(old=>JSON.stringify(old)===JSON.stringify(viewport)?old:viewport);
      const box=element.getBoundingClientRect();
      const next=tourHighlight(box,getComputedStyle(element).borderTopLeftRadius,viewport);
      setRect(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
    };
    const find=()=>{
      element=document.querySelector(step.target);
      if(!element&&attempt++<60){frame=requestAnimationFrame(find);return;}
      if(!element)return;
      if(step.target!=='.dock-add')window.scrollTo({top:Math.max(0,window.scrollY+element.getBoundingClientRect().top-(window.innerWidth<=600?90:112)),behavior:'instant'});
      measure();
      observer=new ResizeObserver(measure);observer.observe(element);
      // Route entrances animate with transforms, which ResizeObserver doesn't report.
      let ticks=0;const follow=()=>{measure();if(++ticks<40)tracking=requestAnimationFrame(follow);};tracking=requestAnimationFrame(follow);
    };
    const resize=()=>{cancelAnimationFrame(frame);cancelAnimationFrame(tracking);observer?.disconnect();attempt=0;find();};
    const visual=window.visualViewport;
    frame=requestAnimationFrame(find);window.addEventListener('resize',resize);window.addEventListener('scroll',measure,true);visual?.addEventListener('resize',measure);visual?.addEventListener('scroll',measure);
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(tracking);observer?.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('scroll',measure,true);visual?.removeEventListener('resize',measure);visual?.removeEventListener('scroll',measure);};
  },[index]);
  const width=Math.min(420,view.width-24),placement=placeTourCard(rect,{width,height:cardHeight},view);
  const cardStyle={left:placement.left,top:placement.top,width,maxHeight:placement.maxHeight,right:'auto',bottom:'auto'};
  return <>{rect&&createPortal(<><svg className="tour-shade" aria-hidden="true" width="100%" height="100%"><defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="white"/><rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx={rect.borderRadius} fill="black"/></mask></defs><rect width="100%" height="100%" fill="#0b1019b8" mask={'url(#'+maskId+')'}/></svg><div className="tour-spotlight" aria-hidden="true" style={rect}/></>,document.body)}
    <Dialog label={step.title} onClose={exit} cardClass="tour-layer tour-anchored" cardStyle={cardStyle} onMeasure={setCardHeight} footer={<div className="experience-actions"><button type="button" className="ghost" onClick={exit}>Skip tour</button>{index>0&&<button type="button" className="ghost" onClick={()=>setIndex(index-1)}>Back</button>}<button type="button" className="btn" onClick={index===tourSteps.length-1?exit:()=>setIndex(index+1)}>{index===tourSteps.length-1?'Finish tour':'Next'}</button></div>}>
      <p className="experience-progress" aria-live="polite">WORKSPACE TOUR · Step {index+1} of {tourSteps.length}</p><MiniPreview kind={step.preview} compact/><p className="experience-description"><BoldCopy text={step.text}/></p>
    </Dialog>
  </>;
}

export default function Experience({mode,onClose,onTour,demo}){
  return mode==='onboarding'?<Onboarding onClose={onClose} onTour={onTour} demo={demo}/>:mode==='tour'?<Tour onClose={onClose}/>:null;
}

export function ReplayIntroduction({onOnboarding,onTour}){
  return <section className="card replay-introduction" data-tour="replay"><h3>Onboarding & tour</h3><p>Skipped a step? Replay the welcome or take the guided tour of Home, Notes, Calendar, Profile and Settings.</p><div className="experience-actions"><button type="button" className="btn" onClick={onOnboarding}>Start onboarding again</button><button type="button" className="ghost" onClick={onTour}>Start guided tour</button></div></section>;
}
