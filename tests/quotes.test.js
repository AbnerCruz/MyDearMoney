import test from 'node:test';
import assert from 'node:assert/strict';
import {BrapiQuoteProvider} from '../src/quotes.js';

test('adaptador normaliza preço e horário sem acoplar a carteira ao payload',async()=>{
 let endpoint='',authorization;
 const provider=new BrapiQuoteProvider(async(url,options)=>{endpoint=url;authorization=options.headers.Authorization;return {ok:true,json:async()=>({results:[{symbol:'PETR4',currency:'BRL',regularMarketPrice:36.65,regularMarketTime:'2026-09-26T12:00:00Z'}]})};});
 assert.deepEqual(await provider.get('PETR4','secret'),{ticker:'PETR4',price:3665,updatedAt:'2026-09-26T12:00:00Z',provider:'brapi'});
 assert.equal(endpoint,'https://brapi.dev/api/quote/PETR4');assert.equal(authorization,'Bearer secret');
});
test('cotação inválida falha sem apagar o cache mantido pelo chamador',async()=>{
 const provider=new BrapiQuoteProvider(async()=>({ok:false,status:429}));
 await assert.rejects(provider.get('VALE3'),/HTTP 429/);
 await assert.rejects(provider.get('../bad'),/Ticker inválido/);
});
