const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;

// Accepts "acme.com" as well as full addresses; only http(s) links are kept.
export function clientLinkUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') && url.href.length <= 300 ? url.href : null; } catch { return null; }
}
export const MAX_CLIENT_LINKS = 10;

export function prepareClient(values) {
  const client = Object.fromEntries(['name','email','phone','address','notes'].map(key=>[key,String(values[key] || '').trim()]));
  if (!client.name) return {error:'Enter a client name.'};
  if (client.email && !/^[^\s@]+@[^\s@]+$/.test(client.email)) return {error:'Enter a valid client email address, or leave it blank.'};
  const links = [];
  for (const link of Array.isArray(values.links) ? values.links : []) {
    const url = clientLinkUrl(link?.url), label = String(link?.label || '').trim().slice(0,40);
    if (url === '') { if (label) return {error:`Add a web address for “${label}”, or remove it.`}; continue; }
    if (!url) return {error:`“${String(link.url).trim()}” isn’t a web address. Try something like acme.com.`};
    links.push({label,url});
  }
  if (links.length > MAX_CLIENT_LINKS) return {error:`Add up to ${MAX_CLIENT_LINKS} links per client.`};
  client.links = links;
  return {client};
}

export function prepareInvoice(workspace, values, lines, editingId) {
  const existing = editingId ? workspace.invoices.find(invoice=>invoice.id===editingId) : null;
  if (editingId && (!existing || existing.state !== 'draft')) return {error:'Only an existing draft can be edited.'};
  const client = workspace.clients.find(c=>c.id===values.client);
  if (!client || (client.arch && existing?.client !== client.id)) return {error:'Choose an active client or add a new client.'};
  if (!validDate(values.issue) || !validDate(values.due)) return {error:'Enter valid issue and due dates.'};
  if (values.due < values.issue) return {error:'Due date cannot be before the issue date.'};
  if (!Array.isArray(lines) || !lines.length) return {error:'Add at least one line item.'};
  const items = lines.map(line=>({desc:String(line.desc || '').trim(),qty:Number(line.qty),price:Number(line.price)}));
  if (items.some(item=>!item.desc)) return {error:'Enter a description for every line item.'};
  if (items.some((item,index)=>lines[index].qty == null || String(lines[index].qty).trim()==='' || !Number.isFinite(item.qty) || item.qty < .001)) return {error:'Each quantity must be a finite number of at least 0.001.'};
  if (items.some((item,index)=>lines[index].price == null || String(lines[index].price).trim()==='' || !Number.isFinite(item.price) || item.price < 0)) return {error:'Each price must be a finite number of zero or more.'};
  const tax = values.tax === '' || values.tax === undefined ? 0 : Number(values.tax);
  if (!Number.isFinite(tax) || tax < 0) return {error:'Enter a valid non-negative tax rate.'};
  const subtotal=items.reduce((sum,item)=>sum+item.qty*item.price,0);
  if (!Number.isFinite(subtotal*(1+tax/100))) return {error:'The invoice total is too large. Check quantities and prices.'};
  const invoice={client:client.id,issue:values.issue,due:values.due,tax,notes:String(values.notes || '').trim(),items};
  if (values.no !== undefined) {
    const no=String(values.no).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._/#-]{0,39}$/.test(no)) return {error:'Use 1–40 letters, numbers, spaces or . _ / # - for the invoice number.'};
    if (workspace.invoices.some(i=>i.id!==editingId && String(i.no || '').toLowerCase()===no.toLowerCase())) return {error:`Invoice number ${no} is already used.`};
    invoice.no=no;
  }
  for (const key of ['title','reference','taxLabel','pay']) if (values[key] !== undefined) invoice[key]=String(values[key]).trim().slice(0,key==='pay'?600:120);
  for (const [group,keys] of Object.entries(PARTY_FIELDS)) if (values[group] !== undefined) invoice[group]=Object.fromEntries(keys.map(key=>[key,String(values[group]?.[key] || '').trim().slice(0,300)]));
  if (invoice.billTo?.email && !/^[^\s@]+@[^\s@]+$/.test(invoice.billTo.email)) return {error:'Enter a valid billing email address, or leave it blank.'};
  return {invoice};
}

// Editable invoice blocks. Empty values fall back to business settings and the client record.
export const PARTY_FIELDS={from:['name','email','phone','address','taxId'],billTo:['name','email','address'],bank:['accountName','bankName','accountNumber','ifsc','swift','iban','upi']};
export function invoiceView(invoice, settings = {}, client = {}) {
  const pick=(own,fallback)=>Object.fromEntries(Object.entries(fallback).map(([key,value])=>[key,own?.[key] || value || '']));
  return {
    from:pick(invoice.from,{name:settings.biz,email:settings.email,phone:settings.phone,address:settings.addr,taxId:settings.taxId}),
    billTo:pick(invoice.billTo,{name:client.name,email:client.email,address:client.address}),
    bank:pick(invoice.bank,Object.fromEntries(PARTY_FIELDS.bank.map(key=>[key,settings.bank?.[key]]))),
    pay:invoice.pay || settings.pay || '',
    taxLabel:invoice.taxLabel || 'Tax',
  };
}

export function nextInvoiceNumber(workspace) {
  const saved=Number(workspace.seq);
  const sequence=Math.max(Number.isSafeInteger(saved) && saved>=0 ? saved : 0,...workspace.invoices.map(i=>{const suffix=/^INV-(\d+)$/.exec(i.no || '');const n=suffix ? Number(suffix[1]) : 0;return Number.isSafeInteger(n) ? n : 0;}));
  if (sequence >= Number.MAX_SAFE_INTEGER) throw new Error('The invoice number limit has been reached.');
  return {seq:sequence+1,no:'INV-'+String(sequence+1).padStart(4,'0')};
}
