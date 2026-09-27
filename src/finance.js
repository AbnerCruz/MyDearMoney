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
export const initial = () => ({schema:4, accounts:[], cards:[], subscriptions:[], transactions:[], installments:[], cardAdjustments:[], debts:[], goals:[], assets:[], investments:[], operations:[], quotes:[], areas:[], strategies:[], scenarios:[], reconciliations:[], audit:[], settings:{}});
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || (raw.schema || 1) > 4) throw new Error('Backup incompatível.');
  const base = initial();
  for (const key of Object.keys(base)) if (raw[key] !== undefined) base[key] = raw[key];
  for (const key of Object.keys(base).filter(k => Array.isArray(base[k]))) if (!Array.isArray(base[key])) throw new Error(`Dados inválidos: ${key}`);
  base.schema=4;
  return base;
}
export const accountBalance = (state, id) => (state.accounts.find(a=>a.id===id)?.opening || 0) + state.transactions.filter(t=>t.status==='realized' && t.accountId===id).reduce((sum,t)=>sum + (t.type==='income'||t.type==='transfer-in' ? t.amount : -t.amount),0);
export const cash = state => state.accounts.filter(a=>!['investment','benefit'].includes(a.kind)).reduce((s,a)=>s+accountBalance(state,a.id),0);
export const benefitBalance = state => state.accounts.filter(a=>a.kind==='benefit').reduce((s,a)=>s+accountBalance(state,a.id),0);
export const totalDebt = state => state.debts.reduce((s,d)=>s+d.balance,0)+state.installments.reduce((sum,item)=>sum+Array.from({length:item.count},(_,index)=>item.paid?.includes(index)?0:Math.floor(item.total/item.count)+(index<item.total%item.count?1:0)).reduce((a,b)=>a+b,0),0)+state.cardAdjustments.filter(a=>!a.paid).reduce((s,a)=>s+a.amount,0)+state.subscriptions.filter(s=>s.cardId).reduce((sum,sub)=>sum+subscriptionOccurrences(state,sub,monthAdd(today(),2)).filter(o=>o.chargeDate<=today()).reduce((a,o)=>a+o.amount,0),0);
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
  const tx=state.transactions.filter(t=>t.status==='realized'&&!t.internal&&state.accounts.find(a=>a.id===t.accountId)?.kind!=='benefit'&&t.date.startsWith(month));
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
export function cardDueDate(card, purchaseDate) {
  const [year,month,day]=purchaseDate.split('-').map(Number);
  const closeMonth=day>card.closingDay?1:0;
  const offset=closeMonth+(card.dueDay<=card.closingDay?1:0);
  return monthAdd(`${year}-${String(month).padStart(2,'0')}-01`,offset).slice(0,8)+String(card.dueDay).padStart(2,'0');
}
export function salaryEstimate({hourlyCents,hours,extraPercent=0,deductionPercent=0,fixedDeductions=0}) {
  if(!Number.isFinite(hours)||hours<0||hours>744||extraPercent<0||deductionPercent<0||deductionPercent>100) throw new Error('Confira horas e percentuais.');
  const gross=Math.round(hourlyCents*hours*(1+extraPercent/100));
  const net=Math.max(0,Math.round(gross*(1-deductionPercent/100))-fixedDeductions);
  return {gross,net,deductions:gross-net};
}
export function subscriptionOccurrences(state, subscription, until) {
  const lastCharge=subscription.active===false&&subscription.cancelDate?subscription.cancelDate:until;
  const out=[];
  for(let i=0;i<240;i++) {
    const chargeDate=monthAdd(subscription.firstDate,i);
    if(chargeDate>lastCharge||chargeDate>until)break;
    if(subscription.paid?.includes(chargeDate))continue;
    const card=state.cards.find(c=>c.id===subscription.cardId);
    const date=card?cardDueDate(card,chargeDate):chargeDate;
    if(date<=until)out.push({chargeDate,date,amount:subscription.amount,subscriptionId:subscription.id,cardId:card?.id,accountId:card?.accountId||subscription.accountId,label:subscription.name});
  }
  return out;
}
export function events(state, from=today(), until=monthAdd(from,12)) {
  const out=[];
  for(const t of state.transactions) {
    if(state.accounts.find(a=>a.id===t.accountId)?.kind==='benefit')continue;
    if(t.status==='planned'&&t.date>=from&&t.date<=until) out.push({id:t.id,date:t.date,label:t.description||t.category||'Movimentação',amount:t.type==='income'?t.amount:-t.amount,source:'planejado',accountId:t.accountId});
    for(const date of recurringDates(t,from,until)) if(!state.transactions.some(o=>o.parentId===t.id&&o.date===date)) out.push({id:`${t.id}:${date}`,date,label:t.description||t.category||'Recorrência',amount:t.type==='income'?t.amount:-t.amount,source:'recorrência',accountId:t.accountId});
  }
  for(const item of state.installments) for(let i=0;i<item.count;i++) {
    const date=monthAdd(item.firstDate,i); if(date>until||item.paid?.includes(i)) continue;
    const amount=Math.floor(item.total/item.count)+(i<item.total%item.count?1:0);
    out.push({id:`${item.id}:${i}`,date:date<from?from:date,label:`${item.description} · ${i+1}/${item.count}${date<from?' (em atraso)':''}`,amount:-amount,source:item.cardId?'cartão':'parcela',accountId:item.accountId});
  }
  for(const adjustment of state.cardAdjustments) if(!adjustment.paid&&adjustment.date<=until) out.push({id:adjustment.id,date:adjustment.date<from?from:adjustment.date,label:adjustment.description,amount:-adjustment.amount,source:'ajuste de fatura',accountId:state.cards.find(c=>c.id===adjustment.cardId)?.accountId});
  for(const subscription of state.subscriptions)for(const occurrence of subscriptionOccurrences(state,subscription,until))if(occurrence.date>=from||subscription.cardId)out.push({id:`${subscription.id}:${occurrence.chargeDate}`,date:occurrence.date<from?from:occurrence.date,label:subscription.name,amount:-subscription.amount,source:subscription.cardId?'pagamento recorrente no cartão':'pagamento recorrente',accountId:occurrence.accountId});
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
export function invoices(state, cardId) {
  const groups=new Map();
  for(const item of state.installments.filter(i=>i.cardId===cardId))for(let index=0;index<item.count;index++){
    if(item.paid?.includes(index))continue;
    const date=monthAdd(item.firstDate,index),key=date.slice(0,7),amount=Math.floor(item.total/item.count)+(index<item.total%item.count?1:0);
    const invoice=groups.get(key)||{month:key,date,amount:0,lines:[]};
    invoice.date=date>invoice.date?date:invoice.date;invoice.amount+=amount;
    invoice.lines.push({kind:item.openingBill?'opening':'purchase',itemId:item.id,index,amount,description:item.description});groups.set(key,invoice);
  }
  for(const sub of state.subscriptions.filter(s=>s.cardId===cardId))for(const occurrence of subscriptionOccurrences(state,sub,monthAdd(today(),2)).filter(o=>o.chargeDate<=today())){
    const key=occurrence.date.slice(0,7),invoice=groups.get(key)||{month:key,date:occurrence.date,amount:0,lines:[]};
    invoice.amount+=occurrence.amount;invoice.lines.push({kind:'recurring',subscriptionId:sub.id,chargeDate:occurrence.chargeDate,amount:occurrence.amount,description:sub.name});groups.set(key,invoice);
  }
  for(const adjustment of state.cardAdjustments.filter(a=>a.cardId===cardId&&!a.paid)){
    const key=adjustment.date.slice(0,7),invoice=groups.get(key)||{month:key,date:adjustment.date,amount:0,lines:[]};
    invoice.date=adjustment.date>invoice.date?adjustment.date:invoice.date;invoice.amount+=adjustment.amount;
    invoice.lines.push({kind:'adjustment',adjustmentId:adjustment.id,amount:adjustment.amount,description:adjustment.description});groups.set(key,invoice);
  }
  return [...groups.values()].filter(i=>i.lines.length).sort((a,b)=>a.month.localeCompare(b.month));
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
