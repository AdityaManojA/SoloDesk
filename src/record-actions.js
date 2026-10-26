// Operates only on Terracove's workspace, never the separate Levern feed.
export function deletionInfo(workspace, kind, id, invoiceId) {
  if (kind === 'payments') {
    const invoice = workspace.invoices.find(i => i.id === invoiceId), payment = invoice?.pays.find(p => p.id === id);
    return payment ? {label:'Delete payment',message:`Delete this payment from ${invoice.no}? Its paid total, balance and revenue reports will be recalculated. This cannot be undone.`} : null;
  }
  const record = workspace[kind]?.find(row => row.id === id);
  if (!record || !['clients','projects','tasks','invoices'].includes(kind)) return null;
  const title = record.name || record.title || record.no;
  if (kind === 'clients') {
    const projects = workspace.projects.filter(p=>p.client===id), ids = new Set(projects.map(p=>p.id));
    const tasks = workspace.tasks.filter(t=>t.client===id || ids.has(t.project));
    const invoices = workspace.invoices.filter(i=>i.client===id);
    return {label:'Delete client & linked data',message:`Delete “${title}” and its ${projects.length} projects, ${tasks.length} tasks and ${invoices.length} invoices, including their payments? Other clients and Levern records are kept. This cannot be undone.`};
  }
  if (kind === 'projects') return {label:'Delete project',message:`Delete “${title}”? Its tasks will be kept and unlinked from this project. This cannot be undone.`};
  if (kind === 'invoices') return {label:'Delete invoice',message:`Delete ${title}, including its ${record.pays.length} payment records? Outstanding balances and revenue reports will be recalculated. This cannot be undone.`};
  return {label:'Delete task',message:`Delete “${title}”? This removes its Terracove calendar entry too. This cannot be undone.`};
}

export function deleteRecord(workspace, kind, id, invoiceId) {
  if (!deletionInfo(workspace,kind,id,invoiceId)) return false;
  if (kind === 'payments') {
    const invoice = workspace.invoices.find(i=>i.id===invoiceId);
    invoice.pays = invoice.pays.filter(p=>p.id!==id); return true;
  }
  if (kind === 'projects') {
    const project = workspace.projects.find(p=>p.id===id);
    workspace.tasks.forEach(task=>{ if (task.project===id) { if (!task.client && project.client) task.client=project.client; task.project=''; } });
  }
  if (kind === 'clients') {
    const projects = new Set(workspace.projects.filter(p=>p.client===id).map(p=>p.id));
    workspace.projects=workspace.projects.filter(p=>!projects.has(p.id));
    workspace.tasks=workspace.tasks.filter(t=>t.client!==id && !projects.has(t.project));
    workspace.invoices=workspace.invoices.filter(i=>i.client!==id);
  }
  workspace[kind]=workspace[kind].filter(record=>record.id!==id);
  // Removing a prerequisite must not leave remaining tasks permanently blocked.
  // Trash captures these field changes so restoring the bundle can recover them.
  const remainingTasks=new Set(workspace.tasks.map(task=>task.id));
  for(const task of workspace.tasks)if(task.dependencies)task.dependencies=task.dependencies.filter(id=>remainingTasks.has(id));
  return true;
}
