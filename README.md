# MyDearMoney

Aplicativo web/PWA de finanças pessoais, local-first e sem conta obrigatória. Esta é a primeira implementação funcional do projeto planejado. Abra em um servidor HTTP, como `npm run serve`, e acesse `http://localhost:4173`. Em produção, hospede os arquivos estáticos por HTTPS (GitHub Pages funciona). Não há dependências de instalação.

## Funciona nesta versão (v0.2)

- Contas com saldo inicial, entradas, saídas, transferências vinculadas e histórico pesquisável.
- Interface com quatro destinos principais (Início, Histórico, Futuro e Mais). O registro comum pede apenas valor e categoria; conta, data, recorrência e estado ficam em “Mais opções”.
- Início com caminhos guiados para cartões, assinaturas, salário por hora e vale-alimentação.
- Múltiplos cartões; cadastro rápido de fatura já existente ou de compra à vista/parcelada com vencimento calculado pelo fechamento e vencimento do cartão. As faturas agrupam compras e assinaturas já cobradas. Não cadastre a fatura total e suas compras individuais em duplicidade.
- Assinaturas mensais em conta ou cartão, com pagamentos registrados e cancelamento das próximas cobranças.
- Vale-alimentação com conta própria, crédito e uso; seu saldo não infla o dinheiro livre nem o patrimônio líquido.
- Estimativa de salário por valor/hora, horas, adicional percentual e descontos, seguida de registro explícito como previsto ou recebido.
- Movimentações realizadas ou planejadas; recorrências diárias, semanais, quinzenais e de 1, 2, 3, 6 ou 12 meses, com data final opcional.
- Compras parceladas e cartões com faturas agrupadas e pagamento registrado; dívidas com projeção de juros mensais, amortização registrada, objetivos e bens.
- Carteira com compra, venda, rendimentos, custo médio, resultado realizado e não realizado. A operação lança o fluxo correspondente na conta selecionada. Preço manual ou consulta brapi para classes da B3, com data e cache local.
- Patrimônio líquido, dashboard, linha do tempo, projeção de saldo, cenários isolados e regras simples de distribuição de renda.
- Conciliação de contas por ajuste visível no histórico; IndexedDB versionado, funcionamento offline após primeiro carregamento, instalação PWA, backup JSON, restauração validada e trilha básica de auditoria.

## Regras dos cálculos

Valores monetários são armazenados em centavos inteiros. Transferências e compra/venda de ativos movimentam contas sem se tornarem receita ou despesa operacional. O saldo presente considera apenas movimentações realizadas; compromissos futuros aparecem na projeção. Compras parceladas distribuem centavos residuais nas primeiras parcelas. Investimentos sem cotação são apresentados pelo custo, com esse estado identificado. As regras de distribuição geram uma proposta e não movimentam dinheiro. Cenários não alteram registros reais.

**Limites conhecidos:** o cálculo do salário é uma estimativa configurável, não um cálculo de folha trabalhista. O app não importa horas de ponto nem extratos bancários. A compra no cartão calcula o vencimento automaticamente, mas compras cadastradas pelo formulário avançado de parcelamento ainda pedem a primeira data manualmente. Assinaturas são mensais e requerem confirmação do pagamento; cancelar uma assinatura não cancela o contrato com o fornecedor. A atualização periódica de cotações ainda não está implementada. A consulta brapi é iniciada pelo usuário; depende de conexão e, fora dos tickers de teste, de um token pessoal e do plano da API. A quitação avulsa de parcelas é sequencial e a amortização registrada exige separar principal de juros; ainda não há conciliação guiada, importação CSV, provisionamento, histórico patrimonial persistido, estratégia condicional, IA, PIN ou backup criptografado. Exporte backups regularmente. Os valores projetados de dívida são estimativas, não reproduzem contratos com CET e taxas específicas.

## Desenvolvimento

```bash
npm test
npm run serve
```

O código de domínio está em `src/finance.js`, persistência e migração em `src/storage.js`, adaptador de cotação em `src/quotes.js`, interface em `src/app.js`. `sw.js` mantém o shell em cache. O aplicativo envia à brapi apenas o ticker consultado e o token informado; a chave vive somente na memória da aba, não no backup. A cotação salva funciona como cache quando a API está indisponível. Consulte a [documentação oficial da brapi](https://brapi.dev/docs/acoes) para limites e autorização.

## Próximas etapas

1. Estornos, juros de cartão e conciliação detalhada da fatura com o extrato.
2. Importação CSV com prévia, mapeamento de colunas e duplicatas; exportação de relatórios.
3. Provisões, reserva de emergência, áreas da vida e estratégias condicionais.
4. Atualização programada de cotações, limites da API e tratamento de variações de mercado.
5. Histórico patrimonial, comparação avançada de cenários, diagnósticos verificáveis.
6. Conciliação guiada, pagamento fora da sequência de parcelas e contratos de dívida com CET.
7. Proteção opcional do backup, testes mobile e acessibilidade ampliada.
8. IA opcional conectada apenas aos resultados calculados, com revisão explícita antes de gravações.

Este documento distingue a versão entregue da visão completa fornecida no planejamento inicial.
