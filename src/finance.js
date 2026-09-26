export const cents = value => {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error('Informe um valor válido.');
  return Math.round(n * 100);
};
export const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format((value || 0) / 100);
export const today = () => new Date().toLocaleDateString('en-CA');
export const dateAdd = (iso, days) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); };
export const monthAdd = (iso, months) => { const [y,m,d] = iso.split('-').map(Number); const first = new Date(Date.UTC(y,m-1+months,1,12)); const last = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate(); first.setUTCDate(Math.min(d,last)); return first.toISOString().slice(0,10); };
export const uid = () => crypto.randomUUID();
export const initial = () => ({schema:1, accounts:[], transactions:[], installments:[], debts:[], goals:[], assets:[], investments:[], operations:[], quotes:[], areas:[], strategies:[], scenarios:[], reconciliations:[], audit:[], settings:{}});
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || (raw.schema || 1) > 1) throw new Error('Backup incompatível.');
  const base = initial();
  for (const key of Object.keys(base)) if (raw[key] !== undefined) base[key] = raw[key];
  for (const key of Object.keys(base).filter(k => Array.isArray(base[k]))) if (!Array.isArray(base[key])) throw new Error(`Dados inválidos: ${key}`);
  return base;
}
export const accountBalance = (state, id) => (state.accounts.find(a=>a.id===id)?.opening || 0) + state.transactions.filter(t=>t.status==='realized' && t.accountId===id).reduce((sum,t)=>sum + (t.type==='income'||t.type==='transfer-in' ? t.amount : -t.amount),0);
export const cash = state => state.accounts.filter(a=>a.kind!=='investment').reduce((s,a)=>s+accountBalance(state,a.id),0);
export const totalDebt = state => state.debts.reduce((s,d)=>s+d.balance,0);
export function positions(state) {
  return state.investments.map(asset => {
    const ops = state.operations.filter(o=>o.assetId===asset.id).sort((a,b)=>a.date.localeCompare(b.date));
    let quantity=0, cost=0, realized=0, yieldReceived=0;
    for (const op of ops) {
      if(op.type==='buy') { quantity+=op.quantity; cost+=op.amount+(op.fee||0); }
      if(op.type==='sell') { if(op.quantity>quantity) throw new Error('Venda excede a posição.'); const basis=quantity ? Math.round(cost*op.quantity/quantity):0; quantity-=op.quantity; cost-=basis; realized+=op.amount-(op.fee||0)-basis; }
      if(op.type==='yield') yieldReceived+=op.amount;
    }
    const quote=state.quotes.find(q=>q.ticker===asset.ticker);
    const value=quote ? Math.round(quantity*quote.price) : cost;
    return {...asset,quantity,cost,realized,yieldReceived,value,unrealized:value-cost,quote};
  });
}
export function netWorth(state) {
  const investmentAccounts=state.accounts.filter(a=>a.kind==='investment').reduce((s,a)=>s+accountBalance(state,a.id),0);
  const invested=positions(state).reduce((s,p)=>s+p.value,0);
  return cash(state)+investmentAccounts+invested+state.assets.reduce((s,a)=>s+a.value,0)-totalDebt(state);
}
export function monthlyFlow(state, month=today().slice(0,7)) {
  const tx=state.transactions.filter(t=>t.status==='realized'&&!t.internal&&t.date.startsWith(month));
  return {income:tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0), expense:tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)};
}
const interval = {daily:1,weekly:7,fortnightly:14};
export function recurringDates(transaction, from, until) {
  if (!transaction.recurrence) return [];
  const {frequency, end, count, paused} = transaction.recurrence;
  if (paused) return [];
  const dates=[]; let next=transaction.date;
  for(let i=0;i<1000 && next<=until;i++) {
    if (i>0 && next>=from && (!end||next<=end) && (!count||i<count)) dates.push(next);
    if ((end&&next>=end)||(count&&i+1>=count)) break;
    next=interval[frequency] ? dateAdd(transaction.date,interval[frequency]*(i+1)) : monthAdd(transaction.date,(({monthly:1,bimonthly:2,quarterly:3,semiannual:6,annual:12})[frequency]||1)*(i+1));
  }
  return dates;
}
export function events(state, from=today(), until=monthAdd(from,12)) {
  const out=[];
  for(const t of state.transactions) {
    if(t.status==='planned'&&t.date>=from&&t.date<=until) out.push({id:t.id,date:t.date,label:t.description||t.category||'Movimentação',amount:t.type==='income'?t.amount:-t.amount,source:'planejado',accountId:t.accountId});
    for(const date of recurringDates(t,from,until)) if(!state.transactions.some(o=>o.parentId===t.id&&o.date===date)) out.push({id:`${t.id}:${date}`,date,label:t.description||t.category||'Recorrência',amount:t.type==='income'?t.amount:-t.amount,source:'recorrência',accountId:t.accountId});
  }
  for(const item of state.installments) for(let i=0;i<item.count;i++) {
    const date=monthAdd(item.firstDate,i); if(date<from||date>until||item.paid?.includes(i)) continue;
    const amount=Math.floor(item.total/item.count)+(i<item.total%item.count?1:0);
    out.push({id:`${item.id}:${i}`,date,label:`${item.description} · ${i+1}/${item.count}`,amount:-amount,source:item.card?'cartão':'parcela',accountId:item.accountId});
  }
  for(const debt of state.debts) if(debt.payment>0&&debt.dueDate) {
    let left=debt.balance; let date=debt.dueDate;
    for(let i=0;i<240&&date<=until&&left>0;i++,date=monthAdd(debt.dueDate,i)) {
      const interest=Math.round(left*(debt.monthlyRate||0)/100); const amount=Math.min(debt.payment,left+interest);
      if (amount<=interest && left>0) break;
      left=Math.max(0,left+interest-amount);
      if(date>=from) out.push({id:`${debt.id}:${i}`,date,label:`${debt.name} · parcela`,amount:-amount,source:'dívida',accountId:debt.accountId});
    }
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export function projection(state, from=today(), until=monthAdd(from,6), additions=[]) {
  let balance=cash(state), minimum=balance;
  const rows=[...events(state,from,until),...additions].sort((a,b)=>a.date.localeCompare(b.date));
  return {start:balance,rows:rows.map(e=>{balance+=e.amount;minimum=Math.min(minimum,balance);return {...e,balance};}),end:balance,minimum};
}
export function scenarioEvents(scenario, from, until) {
  const out=[]; for(const change of scenario.changes||[]) {
    let date=change.date; for(let i=0;i<(change.months||1)&&date<=until;i++,date=monthAdd(change.date,i)) if(date>=from) out.push({id:`${change.id}:${i}`,date,label:change.label,amount:change.amount,source:'simulado'});
  } return out;
}
export function distribute(amount, rules) {
  let left=amount; const allocations=[];
  for(const rule of [...rules].sort((a,b)=>a.priority-b.priority)) {
    const desired=rule.mode==='percent'?Math.round(amount*rule.value/100):rule.mode==='remainder'?left:rule.value;
    const allocated=Math.max(0,Math.min(left,desired)); left-=allocated;
    allocations.push({name:rule.name,amount:allocated});
  }
  return {allocations,left};
}
