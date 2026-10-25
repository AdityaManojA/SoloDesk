export const installNoticeKey='sd_install_notice_v1';
export const onboardingKey=owner=>'sd_onboarding_v1:'+encodeURIComponent(owner);
export function wasSeen(storage,key){try{return storage.getItem(key)==='1';}catch{return false;}}
export function rememberSeen(storage,key){try{storage.setItem(key,'1');return true;}catch{return false;}}

export const tourSteps=[
  {page:'dash',target:'.page-dash .tile-row .tile',preview:'home',title:'Jump back in',text:'Your **three latest edits** live here. Click one to **edit it right on Home**. **View all work** shows everything.'},
  {page:'dash',target:'.page-dash .home-note',preview:'notes',title:'Take a note',text:'Start typing to capture a thought. Switch it to a **checklist** whenever you like.'},
  {page:'notes',target:'.page-notes .notes-index-head',preview:'notes',title:'All your notes',text:'Notes open beside the list. **Enter** adds a line, **Tab** nests a **subtask**, and items can have **reminders**.'},
  {page:'clients',target:'.page-clients .hd > .btn',preview:'clients',title:'Keep your clients together',text:'Open a client to see their **projects**, **notes**, **files** and **invoices** in one place.'},
  {page:'projects',target:'.page-projects .hd > .btn',preview:'projects',title:'Plan the whole project',text:'Add a client **inline**, set a **start date**, and leave the end empty for **ongoing** work.'},
  {page:'calendar',target:'.page-calendar .cal-zoom',preview:'calendar',title:'Zoom through your time',text:'Use **zoom in / out** (or **Ctrl + scroll**) to move between **year, month, week and day**. Colours show **free** and **packed** days.'},
  {page:'invoices',target:'.page-invoices .hd > .btn',preview:'invoices',title:'From draft to paid',text:'Every part of an invoice is **editable**: number, title, parties and **bank details**.'},
  {page:'profile',target:'.page-profile .page-head',preview:'profile',title:'Your public profile',text:'Share **solodesk/your-name** with clients. It stays **private** until you turn it on.'},
  {page:'settings',target:'.page-settings .settings-tabs',preview:'colours',title:'Make this desk yours',text:'Pick an **action colour** in **Appearance**, set **bank details**, and read **What’s new** after each update.'},
];
