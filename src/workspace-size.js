// The workspace is stored across several Firestore documents (see workspace-store.js), so the whole can grow
// past Firestore's 1 MB per document. This cap keeps it to what a browser tab handles comfortably.
export const MAX_WORKSPACE_BYTES=20_000_000;
export function assertWorkspaceSize(workspace){
  const bytes=new TextEncoder().encode(JSON.stringify(workspace)).byteLength;
  if(bytes>MAX_WORKSPACE_BYTES)throw Object.assign(new Error('Workspace too large to save. Changes remain in this tab. Export a JSON backup, then use Undo or reduce large notes or the business logo before retrying.'),{code:'workspace-too-large'});
  return bytes;
}
