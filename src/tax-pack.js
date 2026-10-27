import { round2, csv } from './lib.js';

export function quarterOfDate(dateStr) {
  if (!dateStr || dateStr.length < 7) return null;
  const month = parseInt(dateStr.slice(5, 7), 10);
  const year = dateStr.slice(0, 4);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

export function taxPackSummary(workspace, targetQuarter = null) {
  const invoices = (workspace.invoices || []).filter(i => i.state !== 'void');
  const quarterMap = new Map();

  for (const inv of invoices) {
    const q = quarterOfDate(inv.issue);
    if (!q || (targetQuarter && q !== targetQuarter)) continue;
    const entry = quarterMap.get(q) || { quarter: q, invoiceCount: 0, grossBilled: 0, taxableSubtotal: 0, taxBilled: 0, taxCollected: 0, uncollectedRevenue: 0 };
    entry.invoiceCount++;
    const sub = (inv.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const taxRate = Number(inv.tax) || 0;
    const tax = (sub * taxRate) / 100;
    const total = sub + tax;
    const paid = (inv.pays || []).reduce((s, p) => s + (Number(p.amt) || 0), 0);
    const bal = Math.max(0, total - paid);
    
    // Proportional tax collected based on payment ratio
    const paidRatio = total > 0 ? Math.min(1, paid / total) : 0;
    const collectedTax = tax * paidRatio;

    entry.grossBilled = round2(entry.grossBilled + total);
    entry.taxableSubtotal = round2(entry.taxableSubtotal + sub);
    entry.taxBilled = round2(entry.taxBilled + tax);
    entry.taxCollected = round2(entry.taxCollected + collectedTax);
    entry.uncollectedRevenue = round2(entry.uncollectedRevenue + bal);

    quarterMap.set(q, entry);
  }

  const rows = [...quarterMap.values()].sort((a, b) => b.quarter.localeCompare(a.quarter));
  return rows;
}

export function taxPackCsv(workspace, targetQuarter = null) {
  const summary = taxPackSummary(workspace, targetQuarter);
  const header = ['Quarter', 'Invoices', 'Taxable Base', 'Tax Billed', 'Tax Collected', 'Uncollected Balance', 'Gross Billed'];
  const rows = summary.map(s => [
    s.quarter,
    s.invoiceCount,
    s.taxableSubtotal.toFixed(2),
    s.taxBilled.toFixed(2),
    s.taxCollected.toFixed(2),
    s.uncollectedRevenue.toFixed(2),
    s.grossBilled.toFixed(2)
  ]);
  return csv([header, ...rows]);
}
