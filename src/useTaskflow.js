import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { emptyTaskflow, normalizeTaskflow } from './taskflow-data';

export default function useTaskflow(uid, demo) {
  const [state,setState] = useState({uid:null,status:'signed-out',data:emptyTaskflow()});
  const [attempt,retry] = useState(0);
  useEffect(() => {
    if (!uid || demo || !db) { setState({uid:null,status:demo ? 'demo' : 'signed-out',data:emptyTaskflow()}); return; }
    let active = true;
    setState({uid,status:'loading',data:emptyTaskflow()});
    // Exactly one owner-scoped, read-only document subscription. No writes or chunk reads.
    const unsubscribe = onSnapshot(doc(db,'taskflowUsers',uid,'share','open'),{includeMetadataChanges:true},snapshot => {
      if (!active) return;
      const cached = snapshot.metadata.fromCache;
      setState({uid,status:snapshot.exists() ? 'ready' : cached ? 'loading' : 'missing',cached,data:snapshot.exists() ? normalizeTaskflow(snapshot.data()) : emptyTaskflow()});
    },error => {
      if (active) setState({uid,status:'error',data:emptyTaskflow(),error:error.code === 'permission-denied' ? 'TaskFlow access was denied. Check the shared database rules and sign in with the same Google account.' : 'TaskFlow could not be reached. Check your connection and try again.'});
    });
    return () => { active=false; unsubscribe(); };
  },[uid,demo,attempt]);
  // Never expose a previous account's feed while the next listener is being attached.
  const current = !demo && uid && state.uid === uid ? state : {status:demo ? 'demo' : uid ? 'loading' : 'signed-out',data:emptyTaskflow()};
  return {...current,retry:()=>retry(value=>value+1)};
}
