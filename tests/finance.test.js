import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,accountBalance,cash,netWorth,totalDebt,monthlyFlow,events,invoices,projection,positions,recurringDates,distribute,monthAdd,migrate} from '../src/finance.js';

test('transferência conserva o patrimônio e não entra no fluxo',()=>{
 const s=initial();s.accounts=[{id:'a',opening:100000},{id:'b',opening:20000}];
 s.transactions=[{id:'1',accountId:'a',type:'transfer-out',amount:30000,status:'realized',date:'2026-09-01'},{id:'2',accountId:'b',type:'transfer-in',amount:30000,status:'realized',date:'2026-09-01'}];
 assert.equal(accountBalance(s,'a'),70000);assert.equal(accountBalance(s,'b'),50000);assert.equal(cash(s),120000);assert.deepEqual(monthlyFlow(s,'2026-09'),{income:0,expense:0});
});
test('compra parcelada projeta sem retirar saldo presente; centavos somam exatamente',()=>{
 const s=initial();s.accounts=[{id:'a',opening:10000}];s.installments=[{id:'p',description:'Compra',total:10001,count:3,firstDate:'2026-01-31',accountId:'a',paid:[]}];
 const e=events(s,'2026-01-01','2026-04-30');assert.deepEqual(e.map(x=>x.date),['2026-01-31','2026-02-28','2026-03-31']);assert.equal(e.reduce((n,x)=>n+x.amount,0),-10001);assert.equal(cash(s),10000);
});
test('recorrência preserva o dia âncora e não duplica ocorrência registrada',()=>{
 const t={id:'r',date:'2026-01-31',type:'expense',amount:500,recurrence:{frequency:'monthly'}};
 assert.deepEqual(recurringDates(t,'2026-02-01','2026-04-30'),['2026-02-28','2026-03-31','2026-04-30']);
 const s=initial();s.transactions=[t,{id:'actual',parentId:'r',date:'2026-02-28',status:'realized',type:'expense',amount:500}];
 assert.deepEqual(events(s,'2026-02-01','2026-02-28'),[]);
});
test('operações trocam caixa por ativo e mantêm custo médio',()=>{
 const s=initial();s.accounts=[{id:'a',opening:100000}];s.investments=[{id:'x',ticker:'TEST3'}];
 s.operations=[{id:'buy',assetId:'x',type:'buy',quantity:10,amount:20000,fee:0,date:'2026-01-01'},{id:'sell',assetId:'x',type:'sell',quantity:4,amount:12000,fee:0,date:'2026-02-01'}];
 s.transactions=[{accountId:'a',type:'expense',amount:20000,status:'realized',internal:true},{accountId:'a',type:'income',amount:12000,status:'realized',internal:true}];
 const p=positions(s)[0];assert.equal(p.quantity,6);assert.equal(p.cost,12000);assert.equal(p.realized,4000);assert.equal(netWorth(s),104000);
});
test('cenário e distribuição não mutam o estado real',()=>{
 const s=initial();s.accounts=[{id:'a',opening:100000}];const baseline=projection(s,'2026-01-01','2026-03-31');
 const alt=projection(s,'2026-01-01','2026-03-31',[{date:'2026-02-01',amount:-30000}]);assert.equal(baseline.end,100000);assert.equal(alt.end,70000);assert.equal(s.transactions.length,0);
 const d=distribute(100000,[{name:'reserva',priority:1,mode:'percent',value:20},{name:'dívida',priority:2,mode:'fixed',value:30000},{name:'livre',priority:3,mode:'remainder',value:0}]);assert.deepEqual(d.allocations.map(x=>x.amount),[20000,30000,50000]);assert.equal(d.left,0);
});
test('dívida interrompe parcelas quando saldo é quitado',()=>{
 const s=initial();s.debts=[{id:'d',name:'Dívida',balance:10000,payment:6000,monthlyRate:0,dueDate:'2026-01-10'}];
 const e=events(s,'2026-01-01','2026-12-31');assert.deepEqual(e.map(x=>[x.date,x.amount]),[['2026-01-10',-6000],['2026-02-10',-4000]]);
});
test('fatura agrupa parcelas, quitação reduz passivo e não duplica projeção',()=>{
 const s=initial();s.accounts=[{id:'a',opening:100000}];s.cards=[{id:'c',name:'Cartão',limit:50000,accountId:'a'}];
 s.installments=[{id:'p',cardId:'c',description:'Notebook',total:30001,count:3,firstDate:'2026-01-10',accountId:'a',paid:[]},{id:'q',cardId:'c',description:'Livro',total:1000,count:1,firstDate:'2026-01-10',accountId:'a',paid:[]}];
 assert.equal(invoices(s,'c')[0].amount,11001);assert.equal(totalDebt(s),31001);assert.equal(netWorth(s),68999);
 const invoice=invoices(s,'c')[0];for(const line of invoice.lines)s.installments.find(i=>i.id===line.itemId).paid.push(line.index);
 s.transactions.push({id:'payment',type:'expense',amount:invoice.amount,accountId:'a',status:'realized',date:'2026-01-10'});
 assert.equal(totalDebt(s),20000);assert.equal(netWorth(s),68999);assert.equal(events(s,'2026-01-01','2026-01-31').length,0);
});
test('migrar documento anterior adiciona cartões sem perder contas',()=>{
 const previous={schema:1,accounts:[{id:'a',opening:100}]};const next=migrate(previous);
 assert.equal(next.schema,2);assert.deepEqual(next.cards,[]);assert.equal(next.accounts[0].opening,100);
});
