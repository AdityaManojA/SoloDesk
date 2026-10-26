// Linking a project to a client (or unlinking it) after the fact. The project's tasks follow: tasks that
// had no client, or had the project's previous client, move with the project. Tasks deliberately set to a
// different client are left alone.
export function linkProject(workspace, projectId, clientId) {
  const project = workspace.projects.find(p => p.id === projectId);
  if (!project) throw new Error('This project could not be found.');
  if (clientId && !workspace.clients.some(c => c.id === clientId)) throw new Error('This client could not be found.');
  const previous = project.client || '';
  project.client = clientId || '';
  for (const task of workspace.tasks) if (task.project === projectId && (!task.client || task.client === previous)) task.client = clientId || '';
  return previous;
}

// Projects a client could take on: unassigned ones first, then other clients' (moving them).
export function linkableProjects(workspace, clientId) {
  const open = workspace.projects.filter(p => !p.arch && p.client !== clientId);
  return { unassigned: open.filter(p => !p.client || !workspace.clients.some(c => c.id === p.client)), others: open.filter(p => p.client && workspace.clients.some(c => c.id === p.client)) };
}
