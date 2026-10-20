const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;

export function prepareClient(values) {
  const client = Object.fromEntries(['name','email','phone','address','notes'].map(key=>[key,String(values[key] || '').trim()]));
  if (!client.name) return {error:'Enter a client name.'};
  if (client.email && !/^[^\s@]+@[^\s@]+$/.test(client.email)) return {error:'Enter a valid client email address, or leave it blank.'};
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
  return {invoice:{client:client.id,issue:values.issue,due:values.due,tax,notes:String(values.notes || '').trim(),items}};
}

export function nextInvoiceNumber(workspace) {
  const saved=Number(workspace.seq);
  const sequence=Math.max(Number.isSafeInteger(saved) && saved>=0 ? saved : 0,...workspace.invoices.map(i=>{const suffix=/^INV-(\d+)$/.exec(i.no || '');const n=suffix ? Number(suffix[1]) : 0;return Number.isSafeInteger(n) ? n : 0;}));
  if (sequence >= Number.MAX_SAFE_INTEGER) throw new Error('The invoice number limit has been reached.');
  return {seq:sequence+1,no:'INV-'+String(sequence+1).padStart(4,'0')};
}
