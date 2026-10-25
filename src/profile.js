// Public profile ("mini portfolio"). The editable copy lives in the private workspace; publishing writes a
// separate document at solodeskProfiles/{username}. While private, that document holds only the name.
export const PROFILE_COLLECTION='solodeskProfiles';
export const RESERVED=new Set(['privacy','cookies','portal','u','api','brand','assets','admin','settings','login','signin','signup','app','solodesk','help','support','about','terms','www','index','dash']);
export const normalizeUsername=value=>String(value||'').trim().toLowerCase();
export const validUsername=value=>/^[a-z0-9][a-z0-9_-]{2,29}$/.test(value)&&!RESERVED.has(value);
export const emptyProfile=()=>({username:'',name:'',headline:'',bio:'',location:'',available:false,links:[],clients:[],public:false});
export function safeUrl(value){
  try{const url=new URL(String(value||'').trim());return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&url.href.length<=300?url.href:null;}catch{return null;}
}
const text=(value,max)=>String(value||'').trim().slice(0,max);

export function prepareProfile(input,workspace){
  const username=normalizeUsername(input.username);
  if(!validUsername(username))return {error:'Choose a username of 3–30 lowercase letters, numbers, - or _, starting with a letter or number.'};
  const name=text(input.name,60);
  if(!name)return {error:'Enter the name to show on your profile.'};
  const links=[];
  for(const link of input.links||[]){
    if(!String(link.label||'').trim()&&!String(link.url||'').trim())continue;
    const url=safeUrl(link.url),label=text(link.label,40);
    if(!label||!url)return {error:'Each link needs a label and a full web address starting with https://.'};
    links.push({label,url});
  }
  if(links.length>10)return {error:'Add up to 10 links.'};
  const known=new Set(workspace.clients.map(c=>c.id));
  return {profile:{username,name,headline:text(input.headline,120),bio:text(input.bio,600),location:text(input.location,60),available:!!input.available,links,clients:[...new Set(input.clients||[])].filter(id=>known.has(id)).slice(0,20),public:!!input.public}};
}

// The exact fields other people can read. Client names are shared only when the owner picked them.
export function publicProfileDoc(profile,workspace,uid){
  const base={uid,username:profile.username,name:profile.name,public:!!profile.public};
  if(!profile.public)return base;
  const clients=profile.clients.map(id=>workspace.clients.find(c=>c.id===id)?.name).filter(Boolean).map(name=>name.slice(0,60));
  return {...base,headline:profile.headline,bio:profile.bio,location:profile.location,available:!!profile.available,links:profile.links.map(({label,url})=>({label,url})),clients};
}

// Path routes such as /aditya open a profile; everything else stays on the hash-routed app.
export function profileRoute(pathname){
  let name;try{name=normalizeUsername(decodeURIComponent(String(pathname||'').replace(/^\/+|\/+$/g,'')));}catch{return null;}
  return validUsername(name)?name:null;
}
