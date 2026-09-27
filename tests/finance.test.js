import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,accountBalance,cash,benefitBalance,netWorth,totalDebt,monthlyFlow,events,invoices,cardDueDate,salaryEstimate,subscriptionOccurrences,projection,positions,recurringDates,distribute,monthAdd,migrate,today} from '../src/finance.js';
import {backup,restore} from '../src/storage.js';

test('transferência conserva o patrimônio e não entra no fluxo',()=>{
 const s=initial();s.accounts=[{id:'a',opening:100000},{id:'b',opening:20000}];
 s.transactions=[{id:'1',accountId:'a',type:'transfer-out',amount:30000,status:'realized',date:'2026-09-01'},{id:'2',accountId:'b',type:'transfer-in',amount:30000,status:'realized',date:'2026-09-01'}];
 assert.equal(accountBalance(s,'a'),70000);assert.equal(accountBalance(s,'b'),50000);assert.equal(cash(s),120000);assert.deepEqual(monthlyFlow(s,'2026-09'),{income:0,expense:0});
});
test('conciliação corrige o saldo de uma conta sem virar renda ou gasto do mês',()=>{
 const s=initial();s.accounts=[{id:'bank',kind:'checking',opening:0}];
 s.transactions=[{id:'adjust',accountId:'bank',type:'income',amount:150000,status:'realized',date:'2026-09-27',category:'Ajuste de saldo',reconciliation:true}];
 assert.equal(accountBalance(s,'bank'),150000);assert.deepEqual(monthlyFlow(s,'2026-09'),{income:0,expense:0});
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
test('empréstimo cadastrado por parcelas projeta apenas o que falta, sem descontar o já pago',()=>{
 const s=initial();s.accounts=[{id:'bank',opening:300000}];
 s.debts=[{id:'loan',mode:'installments',name:'Empréstimo',balance:240000,installmentAmount:40000,remainingCount:6,paidCount:4,paidAmount:160000,dueDate:'2026-10-10',accountId:'bank'}];
 assert.equal(totalDebt(s),240000);assert.equal(accountBalance(s,'bank'),300000);
 assert.deepEqual(events(s,'2026-09-27','2027-03-31').filter(e=>e.source==='parcela de empréstimo').map(e=>e.amount),Array(6).fill(-40000));
 s.debts[0].balance=120000;s.debts[0].remainingCount=3;s.debts[0].installmentAmount=40000;s.debts[0].amortizedTotal=100000;
 s.transactions.push({id:'amortization',type:'expense',amount:100000,accountId:'bank',status:'realized',date:'2026-09-27'});
 assert.equal(totalDebt(s),120000);assert.equal(accountBalance(s,'bank'),200000);
 assert.equal(events(s,'2026-09-27','2027-03-31').filter(e=>e.source==='parcela de empréstimo').length,3);
});
test('fatura agrupa parcelas, quitação reduz passivo e não duplica projeção',()=>{
 const s=initial();s.accounts=[{id:'a',opening:100000}];s.cards=[{id:'c',name:'Cartão',limit:50000,accountId:'a'}];
 s.installments=[{id:'p',cardId:'c',description:'Notebook',total:30001,count:3,firstDate:'2026-01-10',accountId:'a',paid:[]},{id:'q',cardId:'c',description:'Livro',total:1000,count:1,firstDate:'2026-01-10',accountId:'a',paid:[]}];
 assert.equal(invoices(s,'c')[0].amount,11001);assert.equal(totalDebt(s),31001);assert.equal(netWorth(s),68999);
 const invoice=invoices(s,'c')[0];for(const line of invoice.lines)s.installments.find(i=>i.id===line.itemId).paid.push(line.index);
 s.transactions.push({id:'payment',type:'expense',amount:invoice.amount,accountId:'a',status:'realized',date:'2026-01-10'});
 assert.equal(totalDebt(s),20000);assert.equal(netWorth(s),68999);assert.equal(events(s,'2026-01-01','2026-01-31').length,0);
});
test('migrar documento anterior adiciona cartões e ajustes sem perder contas',()=>{
 const previous={schema:1,accounts:[{id:'a',opening:100}]};const next=migrate(previous);
 assert.equal(next.schema,4);assert.deepEqual(next.cards,[]);assert.deepEqual(next.subscriptions,[]);assert.deepEqual(next.cardAdjustments,[]);assert.equal(next.accounts[0].opening,100);
});
test('vale-alimentação permanece separado do dinheiro e da renda em conta',()=>{
 const s=initial();s.accounts=[{id:'bank',kind:'checking',opening:100000},{id:'va',kind:'benefit',opening:20000}];
 s.transactions=[{id:'credit',accountId:'va',type:'income',amount:30000,status:'realized',date:'2026-09-01'},{id:'food',accountId:'va',type:'expense',amount:5000,status:'realized',date:'2026-09-02'}];
 assert.equal(cash(s),100000);assert.equal(benefitBalance(s),45000);assert.equal(netWorth(s),100000);assert.deepEqual(monthlyFlow(s,'2026-09'),{income:0,expense:0});
 s.transactions.push({id:'future',accountId:'va',type:'expense',amount:5000,status:'planned',date:'2026-10-01'});
 assert.equal(projection(s,'2026-09-27','2026-10-31').end,100000);
});
test('cartão calcula o primeiro vencimento por fechamento e vencimento',()=>{
 const card={closingDay:25,dueDay:5};assert.equal(cardDueDate(card,'2026-09-20'),'2026-10-05');assert.equal(cardDueDate(card,'2026-09-26'),'2026-11-05');
 assert.equal(cardDueDate({closingDay:10,dueDay:20},'2026-09-09'),'2026-09-20');
});
test('assinatura no cartão aparece na fatura e some após um pagamento',()=>{
 const s=initial();s.cards=[{id:'c',closingDay:25,dueDay:5,accountId:'bank'}];s.subscriptions=[{id:'sub',name:'Streaming',amount:2990,firstDate:'2026-09-20',cardId:'c',accountId:'bank',paid:[],active:true}];
 const due=subscriptionOccurrences(s,s.subscriptions[0],'2026-11-30');assert.deepEqual(due.map(x=>x.date),['2026-10-05','2026-11-05']);
 s.subscriptions[0].paid.push('2026-09-20');assert.deepEqual(subscriptionOccurrences(s,s.subscriptions[0],'2026-10-31'),[]);
 s.subscriptions[0].paid=[];s.subscriptions[0].active=false;s.subscriptions[0].cancelDate='2026-09-27';
 assert.deepEqual(subscriptionOccurrences(s,s.subscriptions[0],'2026-10-31').map(x=>x.date),['2026-10-05']);
});
test('salário por hora permite adicional percentual e descontos',()=>{
 assert.deepEqual(salaryEstimate({hourlyCents:1239,hours:220,extraPercent:20,deductionPercent:12,fixedDeductions:14000}),{gross:327096,net:273844,deductions:53252});
});
test('assinatura já cobrada entra uma vez na fatura e desaparece após pagamento',()=>{
 const s=initial(),charge=today();s.cards=[{id:'c',closingDay:25,dueDay:5,accountId:'bank'}];
 s.subscriptions=[{id:'s',name:'IA',amount:9500,firstDate:charge,cardId:'c',accountId:'bank',paid:[],active:true}];
 assert.equal(invoices(s,'c')[0].amount,9500);
 assert.equal(totalDebt(s),9500);
 s.subscriptions[0].paid.push(charge);
 assert.deepEqual(invoices(s,'c'),[]);
 assert.equal(totalDebt(s),0);
 assert.equal(events(s,charge,cardDueDate(s.cards[0],charge)).filter(e=>e.label==='IA').length,0);
});
test('backup v4 restaura pagamentos recorrentes e aceita backups antigos',()=>{
 const s=initial();s.subscriptions.push({id:'s',name:'Teste',amount:1000,paid:[]});
 assert.equal(restore(backup(s)).subscriptions[0].name,'Teste');
 const old=restore(JSON.stringify({format:'MyDearMoney',version:2,data:{schema:2,accounts:[{id:'a',opening:500}]}}));
 assert.equal(old.schema,4);assert.deepEqual(old.subscriptions,[]);assert.deepEqual(old.cardAdjustments,[]);assert.equal(old.accounts[0].opening,500);
});
test('fatura separa compras, recorrências e diferenças justificadas sem duplicar o caixa',()=>{
 const s=initial();s.accounts=[{id:'bank',opening:100000}];s.cards=[{id:'c',closingDay:25,dueDay:5,accountId:'bank'}];
 s.installments=[{id:'buy',cardId:'c',description:'Coxinha',total:1200,count:1,firstDate:'2026-10-05',accountId:'bank',paid:[]}];
 s.subscriptions=[{id:'sub',cardId:'c',accountId:'bank',name:'Seguro',amount:3500,firstDate:'2026-09-20',paid:[],active:true}];
 s.cardAdjustments=[{id:'adj',cardId:'c',date:'2026-10-05',amount:300,description:'Juros anteriores',paid:false}];
 const invoice=invoices(s,'c').find(i=>i.month==='2026-10');
 assert.equal(invoice.amount,5000);assert.deepEqual(invoice.lines.map(l=>l.kind),['purchase','recurring','adjustment']);
 assert.equal(events(s,'2026-09-27','2026-10-05').reduce((sum,e)=>sum+e.amount,0),-5000);
 for(const line of invoice.lines){if(line.itemId)s.installments[0].paid.push(line.index);if(line.subscriptionId)s.subscriptions[0].paid.push(line.chargeDate);if(line.adjustmentId)s.cardAdjustments[0].paid=true;}
 s.transactions.push({id:'payment',accountId:'bank',type:'expense',amount:5000,status:'realized',date:'2026-10-05'});
 assert.equal(accountBalance(s,'bank'),95000);assert.equal(invoices(s,'c').find(i=>i.month==='2026-10'),undefined);
});
test('salário calculado pode projetar os meses seguintes sem criar receita presente',()=>{
 const s=initial();s.accounts=[{id:'bank',opening:0}];s.transactions=[{id:'sal',type:'income',amount:273844,accountId:'bank',date:'2026-09-30',status:'planned',recurrence:{frequency:'monthly'},salaryCalculation:{net:273844}}];
 assert.equal(accountBalance(s,'bank'),0);
 assert.deepEqual(events(s,'2026-09-27','2026-11-30').map(e=>[e.date,e.amount]),[['2026-09-30',273844],['2026-10-30',273844],['2026-11-30',273844]]);
});
test('parcela e ajuste vencidos entram nos compromissos de agora sem alterar a fatura original',()=>{
 const s=initial();s.accounts=[{id:'bank',opening:10000}];s.cards=[{id:'c',closingDay:25,dueDay:5,accountId:'bank'}];
 s.installments=[{id:'old',cardId:'c',accountId:'bank',description:'Compra anterior',total:2000,count:1,firstDate:'2026-09-05',paid:[]}];
 s.cardAdjustments=[{id:'interest',cardId:'c',date:'2026-09-05',amount:200,description:'Juros do atraso',paid:false}];
 assert.equal(invoices(s,'c')[0].amount,2200);
 assert.deepEqual(events(s,'2026-09-27','2026-10-05').map(e=>[e.date,e.amount]).sort((a,b)=>a[1]-b[1]),[['2026-09-27',-2000],['2026-09-27',-200]]);
 assert.equal(projection(s,'2026-09-27','2026-10-05').end,7800);
});
test('corrigir vínculos de conta e cartão preserva o valor total e move a fatura para o cartão certo',()=>{
 const s=initial();s.accounts=[{id:'geral',kind:'checking',name:'Conta geral',opening:0},{id:'banco',kind:'checking',name:'Banco',opening:0}];
 s.cards=[{id:'wrong',accountId:'geral'},{id:'right',accountId:'banco'}];
 s.transactions=[{id:'salary',accountId:'geral',type:'income',amount:200000,date:'2026-10-05',status:'planned'}];
 s.installments=[{id:'bill',cardId:'wrong',accountId:'geral',openingBill:true,description:'Saldo inicial',total:18490,count:1,firstDate:'2026-10-10',paid:[]}];
 const before=projection(s,'2026-09-27','2026-10-31').end;
 s.transactions[0].accountId='banco';s.installments[0].cardId='right';s.installments[0].accountId='banco';
 assert.deepEqual(invoices(s,'wrong'),[]);assert.equal(invoices(s,'right')[0].amount,18490);
 assert.equal(projection(s,'2026-09-27','2026-10-31').end,before);
 assert.equal(accountBalance(s,'geral'),0);
});
