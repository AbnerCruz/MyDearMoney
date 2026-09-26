// QuoteProvider boundary: the portfolio only consumes {ticker, price, updatedAt, provider}.
export class BrapiQuoteProvider {
  constructor(fetcher=fetch) {this.fetcher=fetcher;}
  async get(ticker, token='') {
    if(!/^[A-Z0-9]{4,12}$/.test(ticker)) throw new Error('Ticker inválido para a B3.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await this.fetcher(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`,{headers:token?{Authorization:`Bearer ${token}`}:{},signal:controller.signal});
      if(!response.ok) throw new Error(response.status===401||response.status===403?'Token brapi ausente ou sem acesso.':`Cotação indisponível (HTTP ${response.status}).`);
      const data=await response.json(),result=data.results?.find(x=>x.symbol===ticker),value=result?.regularMarketPrice;
      if(!Number.isFinite(value)||value<=0||result.currency!=='BRL') throw new Error('A resposta não contém preço válido em reais.');
      return {ticker,price:Math.round(value*100),updatedAt:result.regularMarketTime||data.requestedAt||new Date().toISOString(),provider:'brapi'};
    } catch(error) {if(error.name==='AbortError')throw new Error('A consulta de cotação demorou demais.');throw error;}
    finally {clearTimeout(timer);}
  }
}
