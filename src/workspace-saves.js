// Each authenticated session owns its queue; an old/offline session cannot hold
// up a new account or publish stale save errors into its UI.
export function createWorkspaceSaves(write,onState) {
  let session=null;
  return {
    begin(owner,baseline=null) { session=owner ? {owner,baseline,revision:0,tail:Promise.resolve()} : null; },
    save(data) {
      if (!session) return Promise.resolve(false);
      const current=session,revision=++current.revision;
      onState('saving');
      const operation=current.tail.catch(()=>{}).then(async()=>{
        if (session!==current) return false;
        const baseline=await write(current.owner,data,current.baseline);
        if(baseline!==undefined)current.baseline=baseline;
        return true;
      });
      current.tail=operation;
      // Attach rejection handling immediately, including obsolete sessions.
      return operation.then(saved=>{
        if (session===current && current.revision===revision) onState('saved');
        return saved;
      },error=>{
        if (session===current && current.revision===revision) onState(error?.code==='workspace-conflict'?'conflict':'error',error);
        return false;
      });
    },
  };
}
