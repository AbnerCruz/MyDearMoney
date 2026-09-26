# MyDearMoney

Aplicativo web/PWA de finanças pessoais, local-first e sem conta obrigatória. Esta é a primeira implementação funcional do projeto planejado. Abra em um servidor HTTP, como `npm run serve`, e acesse `http://localhost:4173`. Em produção, hospede os arquivos estáticos por HTTPS (GitHub Pages funciona). Não há dependências de instalação.

## Funciona nesta versão (v0.1)

- Contas com saldo inicial, entradas, saídas, transferências vinculadas e histórico pesquisável.
- Movimentações realizadas ou planejadas; recorrências diárias, semanais, quinzenais e de 1, 2, 3, 6 ou 12 meses, com data final opcional.
- Compras parceladas, dívidas com projeção de juros mensais e parcelas, objetivos e bens.
- Carteira com compra, venda, rendimentos, custo médio, resultado realizado e não realizado. A operação lança o fluxo correspondente na conta selecionada. Preço manual com data de atualização.
- Patrimônio líquido, dashboard, linha do tempo, projeção de saldo, cenários isolados e regras simples de distribuição de renda.
- IndexedDB versionado, funcionamento offline após primeiro carregamento, instalação PWA, backup JSON, restauração validada e trilha básica de auditoria.

## Regras dos cálculos

Valores monetários são armazenados em centavos inteiros. Transferências e compra/venda de ativos movimentam contas sem se tornarem receita ou despesa operacional. O saldo presente considera apenas movimentações realizadas; compromissos futuros aparecem na projeção. Compras parceladas distribuem centavos residuais nas primeiras parcelas. Investimentos sem cotação são apresentados pelo custo, com esse estado identificado. As regras de distribuição geram uma proposta e não movimentam dinheiro. Cenários não alteram registros reais.

**Limites conhecidos:** o fechamento de faturas e a integração automática brapi ainda não estão implementados. As parcelas são projetadas, mas sua quitação individual ainda não é registrável na interface. O saldo devedor pode ser cadastrado, porém amortizações reais ainda não têm fluxo dedicado. Ainda não há conciliação guiada, importação CSV, provisionamento, histórico patrimonial persistido, estratégia condicional, IA, PIN ou backup criptografado. O app não deve ser usado como única cópia dos seus dados; exporte backups regularmente. A cotação manual não equivale a preço de mercado atualizado. Os valores projetados de dívida são estimativas, não reproduzem um contrato com CET e taxas específicas.

## Desenvolvimento

```bash
npm test
npm run serve
```

O código de domínio está em `src/finance.js`, persistência e migração em `src/storage.js`, interface em `src/app.js`. `sw.js` mantém o shell em cache. Nenhuma informação financeira é transmitida pelo código da aplicação. Uma futura integração de cotação deverá usar um adaptador `QuoteProvider`, com cache e informação de data/provedor, sem atrelar o motor de carteira à brapi.

## Próximas etapas

1. Conciliação, quitação de parcelas e amortização de dívidas com histórico auditável.
2. Cartões e faturas, incluindo fechamento, vencimento e estornos.
3. Importação CSV com prévia, mapeamento de colunas e duplicatas; exportação de relatórios.
4. Provisões, reserva de emergência, áreas da vida e estratégias condicionais.
5. Adaptador de cotações brapi, cache offline e testes de indisponibilidade/limites da API.
6. Histórico patrimonial, comparação avançada de cenários, diagnósticos verificáveis.
7. Proteção opcional do backup, testes mobile e acessibilidade ampliada.
8. IA opcional conectada apenas aos resultados calculados, com revisão explícita antes de gravações.

O README original descreve o produto completo; os itens acima distinguem a versão entregue da visão futura.
