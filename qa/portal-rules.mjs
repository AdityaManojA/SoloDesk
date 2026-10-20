// Run only against local emulators; never creates production accounts or documents.
import assert from 'node:assert/strict';
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST,firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
if(!authHost?.startsWith('127.0.0.1:')||!firestoreHost?.startsWith('127.0.0.1:'))throw Error('Local Firebase emulators are required.');
const project='demo-solodesk-test',base=`http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents`;
async function account(name){const r=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:name+'@example.test',password:'Synthetic-emulator-only-123!',returnSecureToken:true})});assert.equal(r.status,200);return r.json();}
const owner=await account('owner'),client=await account('client'),other=await account('other');
const encode=value=>typeof value==='string'?{stringValue:value}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:typeof value==='number'?{integerValue:String(value)}:typeof value==='boolean'?{booleanValue:value}:value===null?{nullValue:null}:{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
const write=(path,user,value)=>fetch(base+'/'+path,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+user.idToken},body:JSON.stringify({fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))})});
const read=(path,user)=>fetch(base+'/'+path,{headers:user?{Authorization:'Bearer '+user.idToken}:{}});
assert.equal((await write('solodeskWorkspaces/'+owner.localId,owner,{json:'private owner data'})).status,200);
const path=`solodeskPortals/${owner.localId}/shares/client-record`,share={ownerUid:owner.localId,clientId:'client-record',recipientUid:client.localId,recipientEmail:client.email,projectIds:[],invoiceIds:[],data:{business:'Example',projects:[],tasks:[],invoices:[]}};
assert.equal((await write(path,owner,share)).status,200);
assert.equal((await read(path,client)).status,200);
assert.equal((await read(path,other)).status,403);
assert.equal((await read(path)).status,403);
assert.equal((await read('solodeskWorkspaces/'+owner.localId,client)).status,403);
assert.equal((await write(path,client,{...share,recipientUid:other.localId})).status,403);
assert.equal((await write('solodeskWorkspaces/'+owner.localId,other,{json:'tampered'})).status,403);
const query=await fetch(base+`/solodeskPortals/${owner.localId}:runQuery`,{method:'POST',headers:{Authorization:'Bearer '+client.idToken,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'shares'}],where:{fieldFilter:{field:{fieldPath:'recipientUid'},op:'EQUAL',value:{stringValue:client.localId}}}}})});assert.equal(query.status,200);assert.ok((await query.json()).some(x=>x.document));
assert.equal((await fetch(base+'/'+path,{method:'DELETE',headers:{Authorization:'Bearer '+owner.idToken}})).status,200);
assert.equal((await read(path,client)).status,403);
assert.equal((await write('taskflowUsers/'+owner.localId+'/share/open',owner,{quests:[]})).status,200);
assert.equal((await read('taskflowUsers/'+owner.localId+'/share/open',other)).status,403);
assert.equal((await write('taskflowBoard/'+owner.localId,owner,{name:'Demo',exp:10})).status,200);assert.equal((await read('taskflowBoard/'+owner.localId,other)).status,200);assert.equal((await write('taskflowBoard/'+owner.localId,other,{name:'Tamper',exp:20})).status,403);
// Existing-account invitations require a verified email, not just a matching signup.
const existingPath=`solodeskPortals/${owner.localId}/shares/existing`;
assert.equal((await write(existingPath,owner,{...share,clientId:'existing',recipientUid:''})).status,200);
assert.equal((await read(existingPath,client)).status,403);
const verified=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-key`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({localId:client.localId,emailVerified:true})});assert.equal(verified.status,200);
const signed=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:client.email,password:'Synthetic-emulator-only-123!',returnSecureToken:true})});assert.equal(signed.status,200);const verifiedClient=await signed.json();
assert.equal((await read(existingPath,verifiedClient)).status,200);
assert.equal((await fetch(base+'/solodeskWorkspaces/'+owner.localId,{method:'DELETE',headers:{Authorization:'Bearer '+owner.idToken}})).status,200);
assert.equal((await read(existingPath,verifiedClient)).status,403);
console.log('Portal rules: owner publishing, client queries, private isolation, cross-account denial, tamper denial, revocation and TaskFlow isolation passed.');

// Exercise the same SDK transaction and secondary-auth mechanisms as the browser.
const {initializeApp,deleteApp}=await import('firebase/app');
const originalFetch=globalThis.fetch;globalThis.fetch=async(...args)=>{try{return await originalFetch(...args);}catch(e){console.error('SDK request failed:',String(args[0]).split('?')[0],e.cause?.code||e.message);throw e;}};
const {getAuth,connectAuthEmulator,signInWithEmailAndPassword,setPersistence,inMemoryPersistence,createUserWithEmailAndPassword,signOut}=await import('firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,runTransaction,terminate}=await import('firebase/firestore');
const {assertUnchanged}=await import('../src/workspace-upgrades.js');
const {createWorkspaceSaves}=await import('../src/workspace-saves.js');
async function sdk(name){const app=initializeApp({apiKey:'fake-key',projectId:project,authDomain:'localhost'},name);const auth=getAuth(app);connectAuthEmulator(auth,'http://'+authHost,{disableWarnings:true});await setPersistence(auth,inMemoryPersistence);const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',Number(firestoreHost.split(':')[1]));return {app,auth,db};}
const a=await sdk('a'),b=await sdk('b'),secondary=await sdk('provisioning');
await signInWithEmailAndPassword(a.auth,owner.email,'Synthetic-emulator-only-123!');await signInWithEmailAndPassword(b.auth,owner.email,'Synthetic-emulator-only-123!');
const provisioned=await createUserWithEmailAndPassword(secondary.auth,'new-portal@example.test','Initial-password-test-123!');assert.notEqual(provisioned.user.uid,owner.localId);assert.equal(a.auth.currentUser.uid,owner.localId);await signOut(secondary.auth);assert.equal(a.auth.currentUser.uid,owner.localId);
const ref=doc(a.db,'solodeskWorkspaces',owner.localId);await setDoc(ref,{json:'initial'});
const writer=db=>async(uid,value,expected)=>{const ref=doc(db,'solodeskWorkspaces',uid),json=JSON.stringify(value);await runTransaction(db,async tx=>{const snap=await tx.get(ref);assertUnchanged(snap.exists()?snap.data().json:null,expected);tx.set(ref,{json});});return json;};
const qa=createWorkspaceSaves(writer(a.db),()=>{}),qb=createWorkspaceSaves(writer(b.db),()=>{});qa.begin(owner.localId,'initial');qb.begin(owner.localId,'initial');assert.equal(await qa.save({tasks:['first']}),true);assert.equal(await qb.save({tasks:['stale']}),false);assert.equal((await getDoc(ref)).data().json,JSON.stringify({tasks:['first']}));
for(const instance of [a,b,secondary]){await terminate(instance.db);await deleteApp(instance.app);}
console.log('SDK checks: secondary account provisioning preserves the owner login; stale saves are rejected by Firestore transactions.');
