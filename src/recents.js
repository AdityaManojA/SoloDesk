// Recently edited work, newest first (like Apple Notes): editing a record, or a note, task or invoice
// that belongs to it, moves it to the top. Everything here reads the owner's private workspace only.
const kinds=['clients','projects','tasks','invoices','notes'];
const time=value=>{if(typeof value==='number')return Number.isFinite(value)?value:0;const t=Date.parse(value||'');return Number.isFinite(t)?t:0;};
const same=(a,b)=>{const {updatedAt:_a,...x}=a,{updatedAt:_b,...y}=b;return JSON.stringify(x)===JSON.stringify(y);};

export function stampUpdated(before,after,now=new Date().toISOString()){
  for(const kind of kinds){
    const previous=new Map((before[kind]||[]).map(row=>[row.id,row]));
    for(const row of after[kind]||[]){const old=previous.get(row.id);if(!old||!same(old,row))row.updatedAt=now;}
  }
}

export function touchedAt(workspace,kind,row){
  let at=time(row.updatedAt||row.createdAt);
  const bump=value=>{at=Math.max(at,time(value));};
  if(kind==='clients')for(const list of ['projects','tasks','invoices','notes'])for(const r of workspace[list]||[])if(r.client===row.id)bump(r.updatedAt);
  if(kind==='projects')for(const list of ['tasks','notes'])for(const r of workspace[list]||[])if(r.project===row.id)bump(r.updatedAt);
  return at;
}

// Records without timestamps (older workspaces) fall back to list order: later-added ranks higher.
const ranked=rows=>rows.sort((a,b)=>b.at-a.at||b.index-a.index);
const entries=(workspace,list,kind,keep=()=>true)=>(workspace[list]||[]).map((row,index)=>({kind,row,index,at:touchedAt(workspace,list,row)})).filter(e=>keep(e.row));

// Home's "Jump back in": the Terracove items you edited most recently — notes, tasks, projects and clients —
// each ranked by its own last edit, so the thing you changed is the thing that shows.
export function recentWork(workspace,{limit=3}={}){
  const own=row=>time(row.updatedAt||row.createdAt);
  const list=(name,kind,keep)=>(workspace[name]||[]).map((row,index)=>({kind,row,index,at:own(row)})).filter(e=>keep(e.row));
  return ranked([...list('notes','note',()=>true),...list('tasks','task',t=>!t.arch),...list('projects','project',p=>!p.arch),...list('clients','client',c=>!c.arch)]).slice(0,limit);
}

export function allWork(workspace){
  return {
    projects:ranked(entries(workspace,'projects','project',p=>!p.arch&&p.status!=='Complete')),
    clients:ranked(entries(workspace,'clients','client',c=>!c.arch)),
    completed:ranked([...entries(workspace,'projects','project',p=>p.status==='Complete'),...entries(workspace,'tasks','task',t=>t.status==='Done'&&!t.arch)]),
  };
}

// Dated, unfinished checklist items on a client's notes, soonest first.
export function clientReminders(workspace,clientId){
  return (workspace.notes||[]).filter(n=>n.client===clientId).flatMap(note=>(note.checklist||[]).filter(c=>!c.done&&c.due).map(c=>({id:c.id,title:c.title,due:c.due,noteId:note.id,noteTitle:note.title}))).sort((a,b)=>a.due.localeCompare(b.due));
}
