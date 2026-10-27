import { rid, today, round2 } from './lib.js';

export function createExpense(workspace, { project = '', client = '', desc = 'Expense', amount = 0, date = today(), category = 'General', id = rid() } = {}) {
  if (!workspace.expenses) workspace.expenses = [];
  const amt = round2(Number(amount) || 0);
  const expense = { id, project, client, desc: String(desc).trim() || 'Expense', amount: amt, date, category };
  workspace.expenses.push(expense);
  return expense;
}

export function projectFinancials(workspace, projectId) {
  const project = workspace.projects.find(p => p.id === projectId);
  if (!project) return { revenue: 0, expenses: 0, netProfit: 0, margin: 0 };
  const invoices = (workspace.invoices || []).filter(i => i.project === projectId && i.state !== 'void');
  const revenue = round2(invoices.reduce((sum, inv) => sum + (inv.pays || []).reduce((pSum, p) => pSum + (Number(p.amt) || 0), 0), 0));
  const expenses = round2((workspace.expenses || []).filter(e => e.project === projectId).reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const netProfit = round2(revenue - expenses);
  const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
  return { revenue, expenses, netProfit, margin };
}
