import {useEffect,useState} from 'react';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,setPersistence,inMemoryPersistence,createUserWithEmailAndPassword,signOut,signInWithEmailAndPassword,signInWithPopup,sendPasswordResetEmail,updatePassword,onAuthStateChanged,EmailAuthProvider,reauthenticateWithCredential,reauthenticateWithPopup,sendSignInLinkToEmail,isSignInWithEmailLink,signInWithEmailLink} from 'firebase/auth';
import {doc,getDoc,setDoc,deleteDoc,onSnapshot,collection,serverTimestamp,addDoc} from 'firebase/firestore';
import {CHEER,meetingMailto,meetingGmail,REPLY_TONE,replyLabel} from './client-feed';
import {auth,db,firebaseOptions,provider} from './firebase';
import {publishablePortal} from './workspace-upgrades';
import {APPROVAL_LABEL,KIND_LABEL} from './approvals';
import {deletePortalShare} from './portal-sync';
import BrandLogo from './BrandLogo';
import Icon from './Icon';

const authMessage=error=>error.code==='auth/operation-not-allowed'?'Email/password sign-in is not enabled in Firebase Authentication. Enable it under Sign-in method.':error.code==='auth/email-already-in-use'?'This email already has an account. Choose “Link existing account”; its current password will stay unchanged.':error.code==='auth/weak-password'?'Choose a stronger password with at least 12 characters.':(error.code==='auth/wrong-password'||error.code==='auth/invalid-credential'||error.code==='auth/invalid-login-credentials')?'That password isn’t right. Check it and try again, or use Forgot password.':error.code==='auth/requires-recent-login'?'Sign out and sign in again before changing your password.':error.code==='permission-denied'?'Portal access was denied. Check your account and sharing permissions.':'Could not complete this request. Check the email, password and connection, then try again.';
const portalUrl=uid=>window.location.origin+'/#/portal/'+uid;

// Publish the latest data to an existing share, keeping what was chosen to share. Returns false when there is no share.
export async function republishShare(d,uid,clientId){
  if(!db||!uid)return false;
  const ref=doc(db,'solodeskPortals',uid,'shares',clientId),snap=await getDoc(ref);
  if(!snap.exists())return false;
  const s=snap.data(),data=publishablePortal(d,clientId,s.projectIds||[],s.invoiceIds||[],s.docIds||[],auth?.currentUser?.email||'');
  if(s.data?.wsStamp&&s.data.wsStamp>data.wsStamp)return true;
  await setDoc(ref,{ownerUid:s.ownerUid,clientId:s.clientId,recipientUid:s.recipientUid,recipientEmail:s.recipientEmail,projectIds:s.projectIds||[],invoiceIds:s.invoiceIds||[],docIds:s.docIds||[],data});
  return true;
}

export function PortalManager({d,user,demo,client,toast}){
  const [email,setEmail]=useState(client.email||''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[existing,setExisting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[grant,setGrant]=useState(null),[provisioned,setProvisioned]=useState(null);
  const projectsOf=d.projects.filter(p=>p.client===client.id),docsOf=(d.docs||[]).filter(x=>x.client===client.id||projectsOf.some(p=>p.id===x.project));
  const [projects,setProjects]=useState([]),[invoices,setInvoices]=useState([]),[docs,setDocs]=useState([]);
  useEffect(()=>{if(demo||!user)return;return onSnapshot(doc(db,'solodeskPortals',user.uid,'shares',client.id),snap=>{const v=snap.exists()?snap.data():null;setGrant(v);if(v){setEmail(v.recipientEmail);setProjects(v.projectIds||[]);setInvoices(v.invoiceIds||[]);setDocs(v.docIds||[]);}},()=>setError('Could not load portal sharing. Retry after checking your connection.'));},[user?.uid,client.id,demo]);
  // Once a portal is live, ticking or unticking something publishes it straight away.
  const toggle=(id,items,set,key)=>{const next=items.includes(id)?items.filter(x=>x!==id):[...items,id];set(next);if(!grant||demo)return;const ids={projectIds:projects,invoiceIds:invoices,docIds:docs,[key]:next};
    setDoc(doc(db,'solodeskPortals',user.uid,'shares',client.id),{ownerUid:grant.ownerUid,clientId:client.id,recipientUid:grant.recipientUid,recipientEmail:grant.recipientEmail,...ids,data:publishablePortal(d,client.id,ids.projectIds,ids.invoiceIds,ids.docIds,user.email||'')}).then(()=>toast(items.includes(id)?'Removed from the portal.':'Added to the portal.')).catch(e=>setError(authMessage(e)));};
  const publish=async e=>{
    e.preventDefault();if(demo){setError('Sign in to create real client accounts. Demo data is never published.');return;}setBusy(true);setError('');let secondary;
    try{
      const normalized=email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new Error('email');
      let recipientUid=grant?.recipientUid||(provisioned?.email===normalized?provisioned.uid:'');
      if(!grant&&!existing&&!recipientUid){
        if(password.length<12){setError('Use at least 12 characters for the initial password.');return;}
        if(password!==confirm){setError('The two passwords don’t match. Type the same password in both fields.');return;}
        // A separate, memory-only Auth instance leaves the workspace owner's login intact.
        secondary=initializeApp(firebaseOptions,'portal-provision-'+crypto.randomUUID());const secondaryAuth=getAuth(secondary);await setPersistence(secondaryAuth,inMemoryPersistence);
        const created=await createUserWithEmailAndPassword(secondaryAuth,normalized,password);recipientUid=created.user.uid;setProvisioned({email:normalized,uid:recipientUid});
        await signOut(secondaryAuth);
      }
      if(grant&&normalized!==grant.recipientEmail){setError('Revoke the existing share before changing its login email.');return;}
      await setDoc(doc(db,'solodeskPortals',user.uid,'shares',client.id),{ownerUid:user.uid,clientId:client.id,recipientUid,recipientEmail:normalized,projectIds:projects,invoiceIds:invoices,docIds:docs,data:publishablePortal(d,client.id,projects,invoices,docs,user.email||'')});
      toast(grant?'Client portal updated.':'Client portal published. Share the portal link and password or send a magic sign-in link.');
    }catch(err){setError(authMessage(err));}finally{setPassword('');setConfirm('');setBusy(false);if(secondary)await deleteApp(secondary);}
  };
  const sendMagicInvite=async()=>{
    const normalized=email.trim().toLowerCase();
    if(!normalized){setError('Enter client email address first.');return;}
    setBusy(true);setError('');
    try{
      await sendSignInLinkToEmail(auth,normalized,{url:portalUrl(user.uid),handleCodeInApp:true});
      toast(`Passwordless magic sign-in link emailed to ${normalized}!`);
    }catch(err){setError(authMessage(err));}finally{setBusy(false);}
  };
  const pick=(title,items,chosen,set,label,empty,key)=><fieldset className="share-picks"><legend>{title}</legend>{items.length?items.map(x=><label key={x.id} className={'share-pick'+(chosen.includes(x.id)?' on':'')}><input type="checkbox" checked={chosen.includes(x.id)} onChange={()=>toggle(x.id,chosen,set,key)}/><span>{label(x)}</span></label>):<p className="empty-note">{empty}</p>}</fieldset>;
  const approvals=d.tasks.filter(t=>t.approval&&(t.client===client.id||projectsOf.some(p=>p.id===t.project)));
  return <section className="card portal-manager">
    <div className="block-head" style={{margin:0}}><h3>Client portal</h3>{grant?<span className="chip sage">Shared</span>:<span className="chip white">Not shared yet</span>}</div>
    <p style={{marginTop:0}}>Your client signs in to see what you pick below, plus their links, brief questionnaires and any task you send them for approval. Internal notes, other clients and private workspace details stay private. The portal updates by itself a moment after you change shared work.</p>
    {error&&<p role="alert" className="inline-error">{error}</p>}
    {grant&&<div className="portal-link-box"><Icon name="link" size={18}/><input readOnly aria-label="Portal link" value={portalUrl(user.uid)} onFocus={e=>e.target.select()}/><button type="button" className="btn sm" onClick={async()=>{try{await navigator.clipboard.writeText(portalUrl(user.uid));toast('Portal link copied.');}catch{toast('Select the link and copy it.');}}}>Copy link</button><button type="button" className="ghost sm" disabled={busy} onClick={sendMagicInvite} title="Email client a passwordless sign-in link">Send magic link</button><a className="ghost sm" href={'#/portal/'+user.uid} target="_blank" rel="noopener noreferrer">Preview ↗</a></div>}
    {approvals.length>0&&<p className="notice soft" style={{margin:0}}>{approvals.filter(t=>t.approval.state==='pending').length} waiting for {client.name} · {approvals.filter(t=>t.approval.state==='approved').length} approved · <a href="#/approvals">Open approvals</a></p>}
    <form onSubmit={publish} className="portal-form">
      <label>Client login email<input type="email" aria-label="Portal email" autoComplete="off" required disabled={!!grant||!!provisioned} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      {!grant&&<><label className="check-row"><input type="checkbox" checked={existing} onChange={e=>{setExisting(e.target.checked);setPassword('');setConfirm('');}}/> Link existing account (keeps its current password; verified email required)</label>
        {!existing&&!provisioned&&<div className="grid2"><label>Initial password<input type="password" aria-label="Portal initial password" minLength={12} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Re-enter password<input type="password" aria-label="Re-enter portal initial password" minLength={12} autoComplete="new-password" required value={confirm} aria-invalid={!!confirm&&confirm!==password} onChange={e=>setConfirm(e.target.value)}/>{confirm&&<small className={confirm===password?'match-ok':'match-bad'}>{confirm===password?'Passwords match':'Passwords don’t match yet'}</small>}</label></div>}
        <p className="mu" style={{margin:0}}>Passwords go straight to Firebase Auth and are never saved in your workspace. Clients can sign in with a password or passwordless magic link.</p></>}
      {pick('Projects and their tasks',projectsOf,projects,setProjects,p=><>{p.name}<small>{d.tasks.filter(t=>t.project===p.id).length} tasks · {p.status}</small></>,'No projects for this client yet.','projectIds')}
      {pick('Documents, PRDs & Briefs',docsOf,docs,setDocs,x=><>{x.title}<small>{x.kind==='prd'?'PRD · '+(x.status||'Draft'):x.kind==='brief'?'Client Intake Brief':'Linked file'}</small></>,'No documents yet. Add them under Files & docs.','docIds')}
      {pick('Sent invoices',d.invoices.filter(i=>i.client===client.id&&i.state==='sent'),invoices,setInvoices,i=><>{i.no}<small>Due {i.due}</small></>,'No sent invoices.','invoiceIds')}
      {grant?<p className="portal-live-note">Updates automatically{grant.data?.updatedAt?' · last published '+new Date(grant.data.updatedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):''}</p>:<div style={{display:'flex',gap:8,alignItems:'center'}}><button className="btn" disabled={busy||demo}>{busy?'Working…':'Set up client access'}</button><button type="button" className="ghost" disabled={busy||demo||!email.trim()} onClick={sendMagicInvite}>Send magic link invite</button></div>}
    </form>
    {demo&&<p className="mu">Sign in to publish a portal. Account creation is disabled in the demo.</p>}
    {grant&&<button className="ghost danger sm" style={{justifySelf:'start'}} disabled={busy} onClick={async()=>{setBusy(true);try{await deletePortalShare(db,user.uid,client.id);toast('Portal access revoked. The client’s Firebase account is kept.');}catch(e){setError(authMessage(e));}finally{setBusy(false);}}}>Revoke portal access</button>}
  </section>;
}

const STATUS_CHIP={Todo:'white','In progress':'sand',Done:'sage'};
const APPROVAL_CHIP={pending:'hero',approved:'sage',changes:'sand'};
const day=iso=>iso?new Date(iso.length===10?iso+'T12:00:00':iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
const host=url=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return url;}};

function ApprovalCard({task,response,project,owner,shareId,user,onMessage,currency,compact=false}){
  const kind=task.kind||'task';
  const [comment,setComment]=useState(''),[signerName,setSignerName]=useState(''),[busy,setBusy]=useState(false),[changing,setChanging]=useState(false);
  const fresh=response&&response.atIso>=task.approval.requestedAt;
  const state=fresh?response.decision:task.approval.state,said=fresh?response.comment:task.approval.comment;
  const signOff=fresh?(response.signerName?{name:response.signerName,email:response.email,signedAt:response.atIso}:null):task.approval.signOff;
  const answer=async decision=>{
    if(decision==='changes'&&!comment.trim()){onMessage('Say what should change, so it can be fixed.');return;}
    setBusy(true);
    try{
      await setDoc(doc(db,'solodeskPortals',owner,'shares',shareId,'responses',task.id),{
        taskId:task.id,
        decision,
        comment:comment.trim().slice(0,1000),
        signerName:signerName.trim().slice(0,100),
        userAgent:navigator.userAgent||'',
        at:serverTimestamp(),
        email:(user.email||'').toLowerCase()
      });
      setChanging(false);
      onMessage(decision==='approved'?(signerName.trim()?'Formally signed and approved. Thank you!':'Approved. Thank you!'):'Your changes were sent.');
      setComment('');
      setSignerName('');
    }
    catch{onMessage('Your answer could not be saved. Check your connection and try again.');}finally{setBusy(false);}
  };
  return <article className={'approval-card state-'+state+(compact?' compact':'')}>
    <div className="approval-head"><span className={'chip '+APPROVAL_CHIP[state]}>{state==='pending'?'Needs your approval':APPROVAL_LABEL[state]}</span><small>Sent {day(task.approval.requestedAt)}</small></div>
    <h3><span className={'kind-tag '+kind}>{KIND_LABEL[kind]}</span> {task.title}</h3>
    {project&&<small className="approval-project">{project.name}</small>}
    {task.approval.note&&<p className="approval-note">“{task.approval.note}”</p>}
    {(task.checklist||[]).length>0&&<ul className="portal-checks">{task.checklist.map((c,i)=><li key={i} className={c.done?'done':''}><i/>{c.title}</li>)}</ul>}
    {kind==='link'&&<a className="portal-file" href={task.url} target="_blank" rel="noopener noreferrer"><span className="file-badge"><Icon name="link" size={16}/></span><span className="grow"><b>Open the file</b><small>{host(task.url)}</small></span><span aria-hidden="true">↗</span></a>}
    {kind==='prd'&&<details className="approval-prd"><summary>Read the PRD / Proposal</summary>{[['Problem',task.prd.problem],['Goals and success measures',task.prd.goals],['Out of scope',task.prd.outOfScope]].filter(([,v])=>v).map(([k,v])=><div key={k}><small>{k}</small><p>{v}</p></div>)}{task.prd.requirements.length>0&&<><small>Requirements</small><ul className="portal-checks">{task.prd.requirements.map((r,i)=><li key={i}><i/>R{i+1} · {r.title}</li>)}</ul></>}</details>}
    {kind==='quote'&&<div className="approval-quote">{task.quote.items.map((l,n)=><p key={n} className="invoice-line"><span>{l.desc}</span><span>{l.qty} × {currency.format(l.price)}</span></p>)}{task.quote.tax>0&&<p className="invoice-line"><span>Tax</span><span>{task.quote.tax}%</span></p>}<p className="invoice-line total"><span>Total</span><b>{currency.format(task.quote.total)}</b></p></div>}
    {state==='pending'||changing?<div className="approval-actions">
      {(kind==='prd'||kind==='task')&&<label>Signer legal name (formal proposal sign-off)<input maxLength={100} placeholder="e.g. Elena Rostova" value={signerName} onChange={e=>setSignerName(e.target.value)}/></label>}
      <label>{kind==='quote'?'Comment (needed if you want changes)':'Comment (needed for changes)'}<textarea rows="2" maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Looks great, or: please make the logo bigger…"/></label>
      <div><button type="button" className="btn approve" disabled={busy} onClick={()=>answer('approved')}><Icon name="check" size={16}/>{kind==='quote'?'Accept quote':signerName.trim()?'Sign & approve':'Approve'}</button><button type="button" className="ghost" disabled={busy} onClick={()=>answer('changes')}>Request changes</button></div>
    </div>
      :<><p className="approval-result">{state==='approved'?'You approved this':'You asked for changes'}{(fresh?response.atIso:task.approval.decidedAt)?' on '+day(fresh?response.atIso:task.approval.decidedAt):''}.{said&&<><br/><span>“{said}”</span></>}{signOff&&<><br/><small style={{color:'var(--sage-dark, #2b6e4e)',fontWeight:600}}>✓ Formally signed by {signOff.name}{signOff.email?` (${signOff.email})`:''}</small></>}</p><button type="button" className="ghost sm" style={{justifySelf:'start'}} onClick={()=>setChanging(true)}>Change my answer</button></>}
  </article>;
}

const timeAgo=iso=>{if(!iso)return 'just now';const m=Math.round((Date.now()-Date.parse(iso))/60000);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':day(iso);};

function TaskThread({task,comments,owner,shareId,user,onMessage,business}){
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[asChange,setAsChange]=useState(false);
  const post=async(kind,body)=>{
    if(kind!=='cheer'&&!body.trim()){onMessage(kind==='change'?'Say what you would like changed.':'Write a comment first.');return;}
    if(!owner){onMessage('This is a preview, so comments are not sent.');return;}
    setBusy(true);
    try{await addDoc(collection(db,'solodeskPortals',owner,'shares',shareId,'comments'),{itemId:task.id,kind,text:(kind==='cheer'?CHEER:body).trim().slice(0,1000),at:serverTimestamp(),email:(user.email||'').toLowerCase(),from:'client'});setText('');setAsChange(false);onMessage(kind==='cheer'?'Sent. That will make their day!':kind==='change'?'Change request sent.':'Comment sent.');}
    catch{onMessage('That could not be sent. Check your connection and try again.');}finally{setBusy(false);}
  };
  return <div className="task-thread">
    {comments.length>0&&<ul className="thread-list">{comments.map(c=><li key={c.id} className={'thread-msg '+c.from+' '+c.kind}><span className="thread-who">{c.from==='owner'?business:'You'}{c.kind==='change'&&<span className="chip sand">Change request</span>}<small>{timeAgo(c.at)}</small></span><p>{c.text}</p></li>)}</ul>}
    <div className="thread-quick"><button type="button" className="cheer-btn" disabled={busy} onClick={()=>post('cheer','')}>💪 You got this</button><button type="button" className={'ghost sm'+(asChange?' on':'')} aria-pressed={asChange} onClick={()=>setAsChange(!asChange)}>Request a change</button></div>
    <form className="thread-form" onSubmit={e=>{e.preventDefault();post(asChange?'change':'comment',text);}}><textarea rows="2" maxLength={1000} aria-label={asChange?'What should change?':'Comment'} placeholder={asChange?'What would you like changed?':'Write a comment…'} value={text} onChange={e=>setText(e.target.value)}/><button className="btn sm" disabled={busy}>{asChange?'Send change request':'Send'}</button></form>
  </div>;
}

function LinkEditor({initial,kind,docId='',owner,shareId,user,onMessage,onDone}){
  const [label,setLabel]=useState(initial?.label||''),[url,setUrl]=useState(initial?.url||''),[busy,setBusy]=useState(false);
  const save=async e=>{e.preventDefault();
    const clean=url.trim();if(!/^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(clean)){onMessage('Enter a web address like acme.com.');return;}
    if(!owner){onMessage('This is a preview, so changes are not sent.');onDone();return;}
    setBusy(true);
    try{await addDoc(collection(db,'solodeskPortals',owner,'shares',shareId,'updates'),{kind,docId,label:label.trim().slice(0,60),url:(/^https?:\/\//i.test(clean)?clean:'https://'+clean).slice(0,300),replaceUrl:(initial?.url||'').slice(0,300),at:serverTimestamp(),email:(user.email||'').toLowerCase()});onMessage('Sent. It appears here once it is saved.');onDone();}
    catch{onMessage('That could not be saved. Check your connection and try again.');}finally{setBusy(false);}
  };
  return <form className="link-editor" onSubmit={save}><input aria-label="Name" placeholder={kind==='file'?'File name':'Name (optional)'} maxLength={60} value={label} onChange={e=>setLabel(e.target.value)}/><input aria-label="Web address" placeholder="acme.com" inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} autoFocus/><button className="btn sm" disabled={busy}>Save</button><button type="button" className="ghost sm" onClick={onDone}>Cancel</button></form>;
}

function BriefCard({doc: bDoc, owner, shareId, user, onMessage}){
  const [answers, setAnswers] = useState(() => Object.fromEntries((bDoc.questions || []).map(q => [q.id, q.answer || ''])));
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(!!bDoc.submittedAt);
  const submit = async e => {
    e.preventDefault();
    if (!owner) { onMessage('This is a preview, so answers are not sent.'); setSubmitted(true); return; }
    for (const q of (bDoc.questions || [])) {
      if (q.required && !answers[q.id]?.trim()) {
        onMessage(`Please answer: "${q.question}"`);
        return;
      }
    }
    setBusy(true);
    try {
      const updatedQuestions = (bDoc.questions || []).map(q => ({
        ...q,
        answer: (answers[q.id] || '').trim().slice(0, 5000)
      }));
      await addDoc(collection(db, 'solodeskPortals', owner, 'shares', shareId, 'updates'), {
        kind: 'brief',
        docId: bDoc.id,
        questions: updatedQuestions,
        at: serverTimestamp(),
        email: (user.email || '').toLowerCase()
      });
      setSubmitted(true);
      onMessage('Intake questionnaire submitted! Thank you.');
    } catch {
      onMessage('Could not submit answers. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return <article className="portal-project portal-brief">
    <div className="approval-head">
      <span className={'chip ' + (submitted ? 'sage' : 'hero')}>{submitted ? 'Submitted' : 'Needs your input'}</span>
      <small>{bDoc.submittedAt ? 'Answered ' + day(bDoc.submittedAt) : (bDoc.questions || []).length + ' questions'}</small>
    </div>
    <h3><span className="kind-tag prd">Brief</span> {bDoc.title}</h3>
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      {(bDoc.questions || []).map((q, idx) => (
        <label key={q.id || idx} style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {idx + 1}. {q.question} {q.required && <span style={{ color: 'var(--hero, #c2593f)' }}>*</span>}
          </span>
          <textarea
            rows="3"
            required={q.required}
            placeholder="Your answer…"
            value={answers[q.id] || ''}
            onChange={e => {
              const val = e.target.value;
              setAnswers(a => ({ ...a, [q.id]: val }));
            }}
          />
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <button type="submit" className="btn sm" disabled={busy}>
          {busy ? 'Submitting…' : submitted ? 'Update answers' : 'Submit questionnaire'}
        </button>
        {submitted && <small className="mu">Submitted. You can update your answers anytime.</small>}
      </div>
    </form>
  </article>;
}

function RequestsTab({data,requests,owner,shareId,user,onMessage}){
  const [title,setTitle]=useState(''),[details,setDetails]=useState(''),[projectId,setProjectId]=useState(''),[busy,setBusy]=useState(false);
  const send=async e=>{e.preventDefault();if(!title.trim())return;
    if(!owner){onMessage('This is a preview, so requests are not sent.');return;}
    setBusy(true);
    try{await addDoc(collection(db,'solodeskPortals',owner,'shares',shareId,'requests'),{title:title.trim().slice(0,200),details:details.trim().slice(0,2000),projectId,at:serverTimestamp(),email:(user.email||'').toLowerCase()});setTitle('');setDetails('');onMessage(`Sent to ${data.business}. You’ll see their answer here.`);}
    catch{onMessage('Your request could not be sent. Check your connection and try again.');}finally{setBusy(false);}
  };
  return <div className="portal-grid">
    <form className="portal-project request-form" onSubmit={send}><h3>Ask for something</h3><p className="empty-note" style={{margin:0}}>A new task, a change or a question. {data.business} replies with whether and when it can be done.</p>
      <label>What would you like?<input required maxLength={200} placeholder="Can you add a blog to the website?" value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Details (optional)<textarea rows="3" maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}/></label>
      {(data.projects||[]).length>0&&<label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Not sure / general</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <button className="btn" disabled={busy||!title.trim()}>Send request</button></form>
    {requests.map(r=><article key={r.id} className={'portal-project request-card'+(r.reply?' answered':'')}><div className="approval-head"><span className={'chip '+(r.reply?REPLY_TONE[r.reply]:'white')}>{replyLabel(r)}</span><small>Asked {day(r.at)}</small></div><h3>{r.title}</h3>{r.details&&<p className="request-details">{r.details}</p>}{r.reply&&<p className="approval-result" style={{margin:0}}>{data.business} replied {r.repliedAt?day(r.repliedAt):''}{r.taskId?' and added it to your tasks':''}.</p>}</article>)}
  </div>;
}

function PortalShare({share,owner,user,onMessage,settings}){
  const data=share.data,[responses,setResponses]=useState({}),[comments,setComments]=useState([]),[thread,setThread]=useState(null),[editing,setEditing]=useState(null),[requests,setRequests]=useState(share.sample?.requests||[]);
  useEffect(()=>{if(!owner||!db)return;return onSnapshot(collection(db,'solodeskPortals',owner,'shares',share.id,'requests'),snap=>setRequests(snap.docs.map(x=>({id:x.id,...x.data(),at:x.data().at?.toDate?.().toISOString()||'',repliedAt:x.data().repliedAt?.toDate?.().toISOString()||''})).sort((a,b)=>b.at.localeCompare(a.at))),()=>{});},[owner,share.id]);
  useEffect(()=>{if(!owner||!db)return;return onSnapshot(collection(db,'solodeskPortals',owner,'shares',share.id,'comments'),snap=>setComments(snap.docs.map(x=>({id:x.id,...x.data(),at:x.data().at?.toDate?.().toISOString()||''})).sort((a,b)=>a.at.localeCompare(b.at))),()=>{});},[owner,share.id]);
  useEffect(()=>{if(!owner||!db)return;return onSnapshot(collection(db,'solodeskPortals',owner,'shares',share.id,'responses'),snap=>setResponses(Object.fromEntries(snap.docs.map(x=>{const r=x.data();return [x.id,{...r,atIso:r.at?.toDate?.().toISOString()||''}];}))),()=>{});},[owner,share.id]);
  const tasks=data.tasks||[],approvals=[...tasks.filter(t=>t.approval),...(data.approvals||[])],pending=approvals.filter(t=>!(responses[t.id]?.atIso>=t.approval.requestedAt)&&t.approval.state==='pending');
  const [tab,setTab]=useState(pending.length?'approvals':'work');
  const currency=new Intl.NumberFormat(undefined,{style:'currency',currency:data.currency||'USD'});
  const docs=data.docs||[],links=data.links||[],invoices=data.invoices||[],projects=data.projects||[];
  const balance=invoices.reduce((s,i)=>s+(i.balance||0),0);
  const tabs=[['approvals','Approvals',pending.length],['work','Projects & tasks',tasks.filter(t=>t.status!=='Done').length],['docs','Links & documents',docs.length+links.length],['requests','Requests',0],['invoices','Invoices',invoices.length],...(settings?[['settings','Settings',0]]:[])];
  return <section className="portal-share" style={data.accent?{'--hero':data.accent}:undefined}>
    <div className="portal-hero">
      <span className="eyebrow">{data.business} · CLIENT PORTAL</span>
      <h1>Hello, {data.clientName}</h1>
      <p>Everything {data.business} is working on for you, in one place. Updated {new Date(data.updatedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}.</p>
      {data.contactEmail&&<div className="meeting-actions"><a className="meeting-btn" target="_blank" rel="noopener noreferrer" href={meetingGmail(data.contactEmail,{business:data.business,clientName:data.clientName,project:projects.length===1?projects[0].name:''})}><Icon name="calendar" size={16}/>Request a meeting</a><a className="meeting-alt" href={meetingMailto(data.contactEmail,{business:data.business,clientName:data.clientName,project:projects.length===1?projects[0].name:''})}>Use my email app instead</a></div>}
      <div className="portal-stats">
        <button type="button" className="portal-stat hero" onClick={()=>setTab('approvals')}><strong>{pending.length}</strong><span>Waiting for your approval</span></button>
        <button type="button" className="portal-stat sand" onClick={()=>setTab('work')}><strong>{projects.length}</strong><span>Active project{projects.length===1?'':'s'}</span></button>
        <button type="button" className="portal-stat sage" onClick={()=>setTab('work')}><strong>{tasks.filter(t=>t.status==='Done').length}/{tasks.length}</strong><span>Tasks done</span></button>
        {invoices.length>0&&<button type="button" className="portal-stat ink" onClick={()=>setTab('invoices')}><strong>{currency.format(balance)}</strong><span>Balance due</span></button>}
      </div>
    </div>
    <nav className="tabs-pill portal-tabs" aria-label="Portal sections">{tabs.map(([k,l,n])=><button type="button" key={k} aria-pressed={tab===k} onClick={()=>setTab(k)}>{l}{n>0&&<span className="tab-count">{n}</span>}</button>)}</nav>
    {tab==='approvals'&&<div className="portal-grid">{approvals.length?[...approvals].sort((a,b)=>(pending.includes(b)-pending.includes(a))||b.approval.requestedAt.localeCompare(a.approval.requestedAt)).map(t=><ApprovalCard key={t.id} task={t} response={responses[t.id]} project={projects.find(p=>p.id===t.projectId)} owner={owner} shareId={share.id} user={user} onMessage={onMessage} currency={currency}/>):<p className="portal-empty">Nothing to approve right now. When {data.business} sends you work to check, it appears here.</p>}</div>}
    {tab==='work'&&<div className="portal-grid">{projects.map(p=>{const list=tasks.filter(t=>t.projectId===p.id),done=list.filter(t=>t.status==='Done').length;return <article className="portal-project" key={p.id}>
      <div className="approval-head"><span className={'chip '+(p.status==='Complete'?'sage':p.status==='On hold'?'sand':'hero')}>{p.status}</span><small>{p.start?day(p.start)+' → '+(p.end?day(p.end):'ongoing'):''}</small></div>
      <h3>{p.name}</h3>
      <div className="portal-progress" role="img" aria-label={`${done} of ${list.length} tasks done`}><i style={{width:(list.length?done/list.length*100:0)+'%'}}/></div><small>{done} of {list.length} tasks done</small>
      <ul className="portal-tasks">{list.map(t=>{const mine=comments.filter(c=>c.itemId===t.id),open=thread===t.id;return <li key={t.id} className={open?'open':''}><div className="portal-task-row" role="button" tabIndex={0} aria-expanded={open} aria-label={(open?'Close ':'Open ')+t.title} onClick={()=>setThread(open?null:t.id)} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&e.target===e.currentTarget){e.preventDefault();setThread(open?null:t.id);}}}><span className={'dot '+(STATUS_CHIP[t.status]||'white')}/><span className="grow"><b>{t.title}</b>{t.due&&<small>Due {day(t.due)}</small>}{(t.checklist||[]).length>0&&<small>{t.checklist.filter(c=>c.done).length}/{t.checklist.length} steps</small>}</span>{t.approval&&<span className={'chip '+APPROVAL_CHIP[t.approval.state]}>{t.approval.state==='pending'?'Needs your approval':APPROVAL_LABEL[t.approval.state]}</span>}<span className={'chip '+(STATUS_CHIP[t.status]||'white')}>{t.status}</span><button type="button" className={'comment-toggle'+(mine.length?' has':'')} aria-expanded={open} aria-label={'Comments on '+t.title} onClick={e=>{e.stopPropagation();setThread(open?null:t.id);}}><Icon name="notes" size={15}/>{mine.length||''}</button></div>{open&&<div className="task-open">{t.due&&<p className="task-open-meta">Due {day(t.due)}</p>}{(t.checklist||[]).length>0&&<ul className="portal-checks">{t.checklist.map((c,i)=><li key={i} className={c.done?'done':''}><i/>{c.title}</li>)}</ul>}{t.approval&&<ApprovalCard compact task={t} response={responses[t.id]} project={null} owner={owner} shareId={share.id} user={user} onMessage={onMessage} currency={currency}/>}<TaskThread task={t} comments={mine} owner={owner} shareId={share.id} user={user} onMessage={onMessage} business={data.business}/></div>}</li>;})}{!list.length&&<li className="empty-note">No tasks yet.</li>}</ul>
    </article>;})}{!projects.length&&<p className="portal-empty">No projects have been shared yet.</p>}</div>}
    {tab==='docs'&&<div className="portal-grid">
      <article className="portal-project"><div className="approval-head"><h3>Your links</h3><button type="button" className="ghost sm" onClick={()=>setEditing({kind:'link'})}>+ Add a link</button></div>
        {links.map((l,i)=>editing?.kind==='link'&&editing.url===l.url?<LinkEditor key={i} initial={l} kind="link" owner={owner} shareId={share.id} user={user} onMessage={onMessage} onDone={()=>setEditing(null)}/>:<div key={i} className="portal-file"><span className="file-badge"><Icon name="link" size={16}/></span><a className="grow" href={l.url} target="_blank" rel="noopener noreferrer"><b>{l.label||host(l.url)}</b><small>{host(l.url)}</small></a><button type="button" className="ghost sm" onClick={()=>setEditing({kind:'link',url:l.url})}>Edit</button></div>)}
        {editing?.kind==='link'&&!editing.url&&<LinkEditor kind="link" owner={owner} shareId={share.id} user={user} onMessage={onMessage} onDone={()=>setEditing(null)}/>}
        {!links.length&&editing?.kind!=='link'&&<p className="empty-note" style={{margin:0}}>Add your website, socials or anything {data.business} should have.</p>}</article>
      {docs.filter(x=>x.kind==='link').length>0&&<article className="portal-project"><h3>Shared files</h3>{docs.filter(x=>x.kind==='link').map(x=>editing?.docId===x.id?<LinkEditor key={x.id} initial={{label:x.title,url:x.url}} kind="file" docId={x.id} owner={owner} shareId={share.id} user={user} onMessage={onMessage} onDone={()=>setEditing(null)}/>:<div key={x.id} className="portal-file"><span className="file-badge"><Icon name="link" size={16}/></span><a className="grow" href={x.url} target="_blank" rel="noopener noreferrer"><b>{x.title}</b><small>{host(x.url)} ↗</small></a><button type="button" className="ghost sm" onClick={()=>setEditing({docId:x.id})}>Update link</button></div>)}</article>}
      {docs.filter(x=>x.kind==='prd').map(x=><details key={x.id} className="portal-project portal-prd"><summary><span className="file-badge prd">P</span><span className="grow"><b>{x.title}</b><small>Product requirements · {x.requirements.length} requirements</small></span><span className={'chip '+(x.status==='Approved'?'sage':x.status==='In review'?'sand':'white')}>{x.status}</span></summary>
        {[['Problem',x.problem],['Goals and success measures',x.goals],['Out of scope',x.outOfScope]].filter(([,v])=>v).map(([k,v])=><div key={k}><small>{k}</small><p>{v}</p></div>)}
        {x.requirements.length>0&&<><small>Requirements</small><ul className="portal-checks">{x.requirements.map((r,i)=><li key={i} className={r.done?'done':''}><i/>R{i+1} · {r.title}</li>)}</ul></>}
      </details>)}
      {docs.filter(x=>x.kind==='brief').map(x=><BriefCard key={x.id} doc={x} owner={owner} shareId={share.id} user={user} onMessage={onMessage}/>)}
      {!docs.length&&!links.length&&<p className="portal-empty">No links or documents have been shared yet.</p>}
    </div>}
    {tab==='requests'&&<RequestsTab data={data} requests={requests} owner={owner} shareId={share.id} user={user} onMessage={onMessage}/>}
    {tab==='settings'&&settings}
    {tab==='invoices'&&<div className="portal-grid">{invoices.map(i=><article className="portal-project" key={i.id}><div className="approval-head"><span className={'chip '+(i.balance>0?'hero':'sage')}>{i.balance>0?'Due '+day(i.due):'Paid'}</span><small>Issued {day(i.issue)}</small></div><h3>{i.no}</h3>{i.items.map((l,n)=><p key={n} className="invoice-line"><span>{l.desc}</span><span>{l.qty} × {currency.format(l.price)}</span></p>)}<p className="invoice-line total"><span>Total</span><b>{currency.format(i.total)}</b></p><p className="invoice-line"><span>Paid</span><span>{currency.format(i.paid)}</span></p><p className="invoice-line"><span>Balance</span><b>{currency.format(i.balance)}</b></p>{i.balance>0&&(i.paymentLink||data.paymentLink)&&<div style={{marginTop:12}}><a className="btn sm" href={i.paymentLink||data.paymentLink} target="_blank" rel="noopener noreferrer">💳 Pay with Card / UPI</a></div>}</article>)}{!invoices.length&&<p className="portal-empty">No invoices have been shared.</p>}</div>}
  </section>;
}

const initials=name=>name.split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase();
function PortalUser({name,email,onSignOut}){
  const shown=name||email||'';
  return <span className="portal-user"><span className="avatar-xl">{initials(shown)||'?'}</span><span className="portal-user-name"><b>{shown}</b>{name&&email&&<small>{email}</small>}</span><button className="ghost sm" onClick={onSignOut}>Sign out</button></span>;
}

export function ClientPortal({owner}){
  const [user,setUser]=useState(auth?.currentUser),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[nextPassword,setNextPassword]=useState(''),[confirmNext,setConfirmNext]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[shares,setShares]=useState([]),[loaded,setLoaded]=useState(false),[showPassword,setShowPassword]=useState(false);
  useEffect(()=>{if(auth)return onAuthStateChanged(auth,setUser);},[]);
  useEffect(()=>{
    if(!auth)return;
    if(isSignInWithEmailLink(auth,window.location.href)){
      let emailForSignIn=window.localStorage.getItem('sd_portal_email_link');
      if(!emailForSignIn){
        emailForSignIn=window.prompt('Please confirm your email address to complete passwordless sign-in:');
      }
      if(emailForSignIn){
        setBusy(true);
        signInWithEmailLink(auth,emailForSignIn.trim(),window.location.href)
          .then(()=>{
            window.localStorage.removeItem('sd_portal_email_link');
            window.history.replaceState({},document.title,window.location.pathname+window.location.hash.split('?')[0]);
            setMessage('Signed in successfully with magic link!');
          })
          .catch(err=>setMessage(authMessage(err)))
          .finally(()=>setBusy(false));
      }
    }
  },[]);
  useEffect(()=>{
    setShares([]);setLoaded(false);if(!user||!owner||!db)return;
    let stopped=false,unsub=[];import('firebase/firestore').then(({collection,query,where})=>{
      if(stopped)return;const feeds=new Map();
      const listen=(field,value)=>onSnapshot(query(collection(db,'solodeskPortals',owner,'shares'),where(field,'==',value)),snap=>{feeds.set(field,snap.docs.map(d=>({id:d.id,...d.data()})));setShares([...new Map([...feeds.values()].flat().map(d=>[d.id,d])).values()]);setLoaded(true);},()=>{setLoaded(true);setMessage('No shared access could be loaded. Ask your project owner to check this account and portal link.');});
      unsub.push(listen('recipientUid',user.uid));if(user.emailVerified)unsub.push(listen('recipientEmail',user.email.toLowerCase()));
    });return()=>{stopped=true;unsub.forEach(f=>f());};
  },[owner,user?.uid,user?.emailVerified]);
  const action=async fn=>{setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(authMessage(e));}finally{setBusy(false);setPassword('');setNextPassword('');setConfirmNext('');setCurrentPassword('');}};
  const sendMagicLink=async()=>{
    const target=email.trim().toLowerCase();
    if(!target){setMessage('Enter your email address above first to receive a sign-in link.');return;}
    setBusy(true);setMessage('');
    try{
      await sendSignInLinkToEmail(auth,target,{url:window.location.href,handleCodeInApp:true});
      window.localStorage.setItem('sd_portal_email_link',target);
      setMessage(`Sign-in link sent to ${target}! Open the link in your email to sign in without a password.`);
    }catch(err){setMessage(authMessage(err));}finally{setBusy(false);}
  };
  if(!auth)return <div className="mid">Client sign-in is not configured.</div>;
  const hasPassword=user?.providerData.some(x=>x.providerId==='password');
  const settings=user&&<div className="portal-grid portal-settings">
    <article className="portal-project"><h3>Your account</h3><p className="invoice-line"><span>Name</span><b>{shares[0]?.data?.clientName||'—'}</b></p><p className="invoice-line"><span>Login email</span><b>{user.email}</b></p><p className="invoice-line"><span>Signed in with</span><b>{hasPassword?'Email and password':'Passwordless / Google'}</b></p><button type="button" className="ghost sm" style={{justifySelf:'start'}} onClick={()=>action(()=>signOut(auth))}>Sign out</button></article>
    <article className="portal-project"><h3>Password</h3>{!showPassword?<><p className="empty-note" style={{margin:0}}>{hasPassword?'Change the password you use to sign in to this portal.':'You sign in with Google or magic link. You can also set a password.'}</p><button type="button" className="ghost sm" style={{justifySelf:'start'}} onClick={()=>setShowPassword(true)}>Change password</button></>:<>
      <form className="portal-password-form" onSubmit={e=>{e.preventDefault();if(nextPassword!==confirmNext){setMessage('The two passwords don’t match. Type the same password in both fields.');return;}if(nextPassword===currentPassword){setMessage('Choose a new password that is different from your current one.');return;}action(async()=>{
        if(hasPassword)await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));else await reauthenticateWithPopup(user,provider);
        await updatePassword(user,nextPassword);setMessage('Password updated.');setShowPassword(false);});}}>
        {hasPassword?<label>Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>:<p className="mu">You’ll confirm before the new password is saved.</p>}
        <label>New password<input required type="password" minLength={12} autoComplete="new-password" value={nextPassword} onChange={e=>setNextPassword(e.target.value)}/></label>
        <label>Re-enter new password<input required type="password" minLength={12} autoComplete="new-password" value={confirmNext} aria-invalid={!!confirmNext&&confirmNext!==nextPassword} onChange={e=>setConfirmNext(e.target.value)}/>{confirmNext&&<small className={confirmNext===nextPassword?'match-ok':'match-bad'}>{confirmNext===nextPassword?'Passwords match':'Passwords don’t match yet'}</small>}</label>
        <div className="context-actions" style={{margin:0}}><button className="btn" disabled={busy}>Update password</button><button type="button" className="ghost" onClick={()=>{setShowPassword(false);setCurrentPassword('');setNextPassword('');setConfirmNext('');}}>Cancel</button></div></form></>}</article>
  </div>;
  return <main className="portal-shell portal-v2">
    <header className="portal-top"><BrandLogo/>{user&&<PortalUser name={shares[0]?.data?.clientName} email={user.email} onSignOut={()=>action(()=>signOut(auth))}/>}</header>
    {message&&<p role="status" className="notice soft portal-message">{message}</p>}
    {!user?<section className="portal-signin"><span className="eyebrow">CLIENT PORTAL</span><h1>Welcome back</h1><p>Sign in to see your projects, approve work and open shared documents.</p><form onSubmit={e=>{e.preventDefault();action(()=>signInWithEmailAndPassword(auth,email.trim(),password));}}><label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn" disabled={busy}>Sign in</button></form><div className="portal-signin-alt"><button type="button" className="ghost" disabled={busy} onClick={sendMagicLink}>Email me a sign-in link (no password)</button><button type="button" className="ghost" disabled={busy} onClick={()=>action(()=>signInWithPopup(auth,provider))}>Continue with Google</button><button type="button" className="ghost" disabled={busy||!email.trim()} onClick={()=>action(async()=>{await sendPasswordResetEmail(auth,email.trim());setMessage('If this email has an eligible account, password reset instructions have been sent.');})}>Forgot password</button></div></section>
    :<>{!loaded?<p className="portal-empty">Loading your shared work…</p>:!shares.length?<><p className="portal-empty">No work has been shared with this account at this portal link yet.</p>{settings}</>:shares.map(share=><PortalShare key={share.id} share={share} owner={owner} user={user} onMessage={setMessage} settings={settings}/>)}
</>}
  </main>;
}

export function PortalPreview(){
  const today=new Date().toISOString();
  const share={id:'preview',sample:{requests:[{id:'r1',title:'Can you add a blog to the website?',details:'Something simple, 2–3 posts a month.',at:today,reply:'custom',replyText:'Ready by Friday 30 Oct',repliedAt:today,taskId:'x'},{id:'r2',title:'Could the logo be bigger on mobile?',details:'',at:today}]},data:{business:'Your studio',contactEmail:'studio@example.com',clientName:'Ava Studio',currency:'INR',accent:getComputedStyle(document.documentElement).getPropertyValue('--hero').trim(),updatedAt:today,
    paymentLink:'https://checkout.stripe.com/pay/test',
    links:[{label:'Website',url:'https://example.com/'},{label:'',url:'https://instagram.com/example'}],
    projects:[{id:'p',name:'Website launch',status:'Active',start:'2026-10-16',end:''}],
    tasks:[{id:'a',projectId:'p',title:'Homepage design',status:'In progress',due:'2026-10-30',checklist:[{title:'Hero section',done:true},{title:'Footer',done:false}],approval:{state:'pending',note:'Here is the homepage. Happy for it to go live?',requestedAt:today}},{id:'b',projectId:'p',title:'Brand colours',status:'Done',due:'',checklist:[],approval:{state:'approved',note:'',requestedAt:'2026-10-20T10:00:00.000Z',decidedAt:'2026-10-21T10:00:00.000Z',comment:'Love it'}},{id:'c',projectId:'p',title:'Content inventory',status:'Todo',due:'2026-11-04',checklist:[]}],
    docs:[{id:'d',kind:'prd',title:'Website PRD',status:'In review',problem:'The current site is slow and hard to update.',goals:'Loads in under 2 seconds on 4G.',outOfScope:'',requirements:[{title:'Editors can publish pages',done:true},{title:'Homepage loads under 2s',done:false}]},{id:'b1',kind:'brief',title:'Client Project Questionnaire',questions:[{id:'q1',question:'What is your primary launch goal?',answer:'',required:true},{id:'q2',question:'Any reference websites you admire?',answer:'',required:false}],submittedAt:''},{id:'e',kind:'link',title:'Content inventory',url:'https://drive.google.com/'}],
    approvals:[{id:'q',kind:'quote',title:'INV-0008 · Phase 2',projectId:'p',approval:{state:'pending',note:'Quote for phase 2. Happy to go ahead?',requestedAt:today},quote:{no:'INV-0008',items:[{desc:'Blog templates',qty:1,price:18000},{desc:'Content migration',qty:10,price:1200}],tax:18,total:35400}},{id:'d2',kind:'prd',title:'Website PRD',projectId:'p',approval:{state:'pending',note:'',requestedAt:today},prd:{problem:'The current site is slow and hard to update.',goals:'Loads in under 2 seconds on 4G.',outOfScope:'',requirements:[{title:'Editors can publish pages'},{title:'Homepage loads under 2s'}]}}],
    invoices:[{id:'i',no:'INV-0007',issue:'2026-10-20',due:'2026-11-03',items:[{desc:'Website design',qty:1,price:12000}],total:12000,paid:0,balance:12000,paymentLink:'https://checkout.stripe.com/pay/test'}]}};
  return <main className="portal-shell portal-v2"><header className="portal-top"><BrandLogo/><span className="chip sand">Preview · sample data</span><PortalUser name={share.data.clientName} email="studio@example.com" onSignOut={()=>{}}/></header><PortalShare share={share} owner="" user={{email:''}} onMessage={()=>{}} settings={<div className="portal-grid portal-settings"><article className="portal-project"><h3>Your account</h3><p className="invoice-line"><span>Name</span><b>Ava Studio</b></p><p className="invoice-line"><span>Login email</span><b>studio@example.com</b></p><p className="invoice-line"><span>Signed in with</span><b>Email and password</b></p></article><article className="portal-project"><h3>Change your password</h3><form className="portal-password-form" onSubmit={e=>e.preventDefault()}><label>Current password<input type="password" disabled/></label><label>New password<input type="password" disabled/></label><label>Re-enter new password<input type="password" disabled/></label><button className="btn" disabled>Update password</button></form></article></div>}/></main>;
}
