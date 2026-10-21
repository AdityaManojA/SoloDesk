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
  return <>{visible&&<aside className="install-notice" aria-label="Install SoloDesk"><span><b>Your desk, one tap away.</b> Add SoloDesk to your Home Screen or desktop.</span><div><button type="button" className="btn sm" onClick={()=>{if(install.canPrompt)void installController.prompt();setOpen(true);setVisible(false);}}>Add to Home Screen</button><button type="button" className="icon-button" aria-label="Dismiss install suggestion" onClick={()=>setVisible(false)}>×</button></div></aside>}
    {open&&<Dialog label="Add SoloDesk to your device" onClose={()=>setOpen(false)}><InstallApp compact initialExpanded/><button type="button" className="ghost" onClick={()=>setOpen(false)}>Done</button></Dialog>}
  </>;
}

function BoldCopy({text}){
  return text.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part);
}

function MiniPreview({kind,compact=false}){
  return <figure className={'experience-preview'+(compact?' compact':'')} aria-label="Illustrative screen example"><figcaption><span>SOLODESK</span><span>Example</span></figcaption>
    {kind==='dashboard'&&<div className="preview-metrics"><div><span>Revenue received</span><strong>₹24,000</strong><small>From payments</small></div><div><span>Active projects</span><strong>03</strong><small>Work in progress</small></div></div>}
    {(kind==='workflow'||kind==='clients'||kind==='projects')&&<div className="preview-workflow"><div><span className="preview-avatar">AS</span><span><small>CLIENT</small><strong>Ava Studio</strong></span></div><span className="preview-connector">↓</span><div><span className="preview-symbol">▧</span><span><small>PROJECT</small><strong>Website launch</strong></span><span className="preview-tag">In progress</span></div>{kind!=='clients'&&<div className="preview-task"><span>○</span><span>Review homepage</span><span className="preview-tag">Tomorrow</span></div>}</div>}
    {(kind==='create'||kind==='tasks')&&<div className="preview-create"><div className="preview-task"><span>○</span><strong>Review homepage</strong><span className="preview-tag">High</span></div><div className="preview-dock"><span>Home</span><span>Tasks</span><span className="preview-plus">+</span><span>Calendar</span><span>More</span></div><span className="preview-caption">{kind==='create'?'Tap + → choose what to create':'Add a deadline → see it on your calendar'}</span></div>}
    {kind==='calendar'&&<><div className="preview-calendar">{['Mon 19','Tue 20','Wed 21'].map((day,i)=><div key={day}><small>{day}</small>{i===0?<span className="preview-cal-task">Review draft <span>↗</span></span>:i===1?<><span className="preview-cal-task moved">Review draft</span><span className="preview-cal-google">Google · Call<br/>10:00</span></>:<span className="preview-cal-tf">TF · Send brief</span>}</div>)}</div><span className="preview-caption">Drag SoloDesk work · TaskFlow & Google stay read-only</span></>}
    {kind==='invoices'&&<div className="preview-invoice"><div><strong>INV-0001</strong><span>Ava Studio</span></div><div><span>Website design</span><strong>₹12,000</strong></div><div className="preview-invoice-flow"><span>Draft</span><span>→</span><span>Sent</span><span>→</span><strong>Paid ✓</strong></div></div>}
    {(kind==='install'||kind==='settings')&&<div className="preview-device"><span className="preview-app"><BrandMark size={40}/><strong>SoloDesk</strong></span><div><strong>{kind==='install'?'Your desk, one tap away':'Onboarding & tour'}</strong><span className="preview-fake-button">{kind==='install'?'Add to Home Screen':'Start onboarding again'}</span><small>{kind==='install'?'Desktop · iPhone / iPad · Android':'Settings → Getting started'}</small></div></div>}
  </figure>;
}

const welcomeSteps=[
  {title:'Your work, at a glance',preview:'dashboard',text:'See **revenue**, **unpaid invoices** and **active projects** in one place.'},
  {title:'Client → project → task',preview:'workflow',text:'Tap **+** to add a **client**, their **project**, then the next **task**.'},
  {title:'Make room for your work',preview:'calendar',text:'**Drag** SoloDesk items to reschedule. See **TaskFlow & Google events** with the **same Google account**.'},
  {title:'Keep your desk close',preview:'install',text:'**Add to Home Screen**, then try the **guided tour** or jump into work.'},
];

function Onboarding({onClose,onTour,demo}){
  const [step,setStep]=useState(0),content=welcomeSteps[step],last=step===welcomeSteps.length-1;
  return <Dialog label={content.title} onClose={onClose} footer={<div className="experience-actions"><button type="button" className="ghost" onClick={step?()=>setStep(step-1):onClose}>{step?'Back':'Skip onboarding'}</button>{last?<><button type="button" className="ghost" onClick={onClose}>Go to workspace</button><button type="button" className="btn" onClick={onTour}>Start guided tour</button></>:<button type="button" className="btn" onClick={()=>setStep(step+1)}>Next</button>}</div>}>
    <p className="experience-progress" aria-live="polite">GETTING STARTED · {step+1} / {welcomeSteps.length}</p>
    <nav className="experience-steps" aria-label="Onboarding steps">{['Welcome','Your workflow','Calendar','Install & start'].map((title,index)=><button type="button" key={title} aria-label={'Step '+(index+1)+': '+title} aria-current={index===step?'step':undefined} onClick={()=>setStep(index)}><span>{index+1}</span>{title}</button>)}</nav>
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
      <p className="experience-progress" aria-live="polite">WORKSPACE TOUR · Step {index+1} of {tourSteps.length}</p><MiniPreview kind={['dashboard','create','clients','projects','tasks','calendar','invoices','settings'][index]} compact/><p className="experience-description"><BoldCopy text={step.text}/></p>
    </Dialog>
  </>;
}

export default function Experience({mode,onClose,onTour,demo}){
  return mode==='onboarding'?<Onboarding onClose={onClose} onTour={onTour} demo={demo}/>:mode==='tour'?<Tour onClose={onClose}/>:null;
}

export function ReplayIntroduction({onOnboarding,onTour}){
  return <section className="card replay-introduction" data-tour="replay"><h3>Onboarding & tour</h3><p>Skipped a step? Start onboarding again or take the guided tour. You can return here at any time on desktop or mobile.</p><div className="experience-actions"><button type="button" className="btn" onClick={onOnboarding}>Start onboarding again</button><button type="button" className="ghost" onClick={onTour}>Start guided tour</button></div></section>;
}
