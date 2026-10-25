export const installNoticeKey='sd_install_notice_v1';
export const onboardingKey=owner=>'sd_onboarding_v1:'+encodeURIComponent(owner);
export function wasSeen(storage,key){try{return storage.getItem(key)==='1';}catch{return false;}}
export function rememberSeen(storage,key){try{storage.setItem(key,'1');return true;}catch{return false;}}

export const tourSteps=[
  {page:'dash',target:'.page-dash .tile-row .tile',title:'Jump back in',text:'Your **three most recently edited** clients, projects and quests stay here. **View all work** shows everything.'},
  {page:'dash',target:'.page-dash .side-col .wide-btn',title:'Plan your day',text:'**Add task** and see **today’s timeline** here. On a phone, tap **+** to create anything.'},
  {page:'clients',target:'.page-clients .hd > .btn',title:'Keep your clients together',text:'Use **Add client** to get started. Open a client to see their **projects**, **tasks** and **invoices**.'},
  {page:'projects',target:'.page-projects .hd > .btn',title:'Plan the whole project',text:'Add **start & end dates** to put a **project timeline** on your calendar.'},
  {page:'tasks',target:'.page-tasks .hd > .btn',title:'Give each task a next step',text:'Set a **priority** and **deadline**. Shared **TaskFlow quests** stay **read-only**.'},
  {page:'calendar',target:'.page-calendar .view-switch',title:'Make room for your work',text:'Use **Month** or **Agenda**. **Drag** SoloDesk work, or open it → **Move to date**. Edit shared events in their **source app**.'},
  {page:'invoices',target:'.page-invoices .hd > .btn',title:'From draft to paid',text:'Create a **draft** → mark it **sent** → **record payment**. Reports use recorded payments.'},
  {page:'settings',target:'.page-settings .tabs-pill',title:'Make this desk yours',text:'Pick your **action colour** in **Appearance**, set **bank details** for invoices, and read **What’s new**. Replay this tour from **Data & connections**.'},
];
