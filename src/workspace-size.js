// Leave room for Firestore's document name, field name and metadata overhead.
export const MAX_WORKSPACE_BYTES=1_000_000;
export function assertWorkspaceSize(workspace){
  const bytes=new TextEncoder().encode(JSON.stringify(workspace)).byteLength;
  if(bytes>MAX_WORKSPACE_BYTES)throw Object.assign(new Error('Workspace too large to save. Changes remain in this tab. Export a JSON backup, then use Undo or reduce large notes or the business logo before retrying.'),{code:'workspace-too-large'});
  return bytes;
}
