# Financeiro Carrefour · Web

Frontend em **Angular 22.2.4 / CLI 22.2.5**, TypeScript 6, standalone components, Signals e rotas lazy, para o [backend financeiro-carrefour-v2](https://github.com/ediorhodendev/financeiro-carrefour-v2). Interface em português e código em inglês.

O painel permite registrar créditos e débitos, consultar saldo atual e histórico, navegar no extrato, fazer estorno integral e observar o fluxo de mensageria real. Projeto técnico independente, sem vínculo institucional com o Carrefour. A marca pertence ao seu titular; origem e ajuste de enquadramento do SVG em [NOTICE](public/brand/NOTICE.md).

## Subir com Docker

Pré-requisitos: Git, Docker Engine / Docker Desktop em execução e Docker Compose v2. Não é necessário instalar Node ou .NET para executar via Docker. Os dois repositórios podem ficar lado a lado. **Suba o backend antes do frontend**: o frontend utiliza sua rede Docker existente.

```bash
git clone https://github.com/ediorhodendev/financeiro-carrefour-v2.git
cd financeiro-carrefour-v2
docker compose up -d --build --wait --wait-timeout 180
cd ..
git clone https://github.com/ediorhodendev/financeiro-carrefour-web.git
cd financeiro-carrefour-web
docker compose up -d --build --wait
```

Abra **http://localhost:4200** e clique em **Conectar ambiente → Conectar ambiente**. A interface chama `POST /demo/access` do Ledger e recebe o JWT e a conta demo. O backend precisa estar em Development com demonstração habilitada, como no Compose V2. A conexão não cria movimentações automaticamente. Use **Token próprio** para um JWT existente e o UUID de uma conta autorizada.

| Serviço             | Endereço local         |
| ------------------- | ---------------------- |
| Frontend            | http://localhost:4200  |
| Ledger API          | http://localhost:5081  |
| Balance API         | http://localhost:5082  |
| RabbitMQ Management | http://localhost:15673 |

A configuração padrão pressupõe a rede `financeiro-carrefour-v2_default` e os serviços `ledger-api`, `balance-api` e `rabbitmq`. Se mudou o nome do projeto Compose, configure `BACKEND_NETWORK`. Não use `localhost` como host de outro container.

Para personalizar, copie `.env.example` para `.env` (`cp .env.example .env` no Bash; `Copy-Item .env.example .env` no PowerShell). **RABBITMQ_PASSWORD precisa ser igual à usada no backend.** As credenciais padrão são exclusivamente locais e demonstrativas. O Node recebe essas variáveis no servidor; elas não são incluídas no bundle Angular.

```bash
# Reconstruir somente o frontend após git pull
git pull
docker compose up -d --build --force-recreate
# Diagnóstico
docker compose ps
docker compose logs -f frontend
# Parar somente o frontend
docker compose down
```

Para zerar **apenas os dados deste desafio**, pare primeiro o frontend e execute `docker compose down -v` na pasta do backend. Isso apaga definitivamente os volumes de banco, broker e chaves demo do V2. Ao subir novamente, obtenha um novo token. Não é necessário limpar todo o Docker nem afetar outros projetos.

## O que cada tela faz

| Tela              | Funcionalidades                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visão geral       | Conta selecionada, saldo materializado, quantidade de lançamentos, sequência projetada, fila global e últimos 8 lançamentos em ordem crescente de sequência |
| Nova movimentação | Crédito/entrada ou débito/saída, descrição, referência opcional e chave de idempotência automática                                                          |
| Movimentações     | Extrato paginado, filtro por período UTC, saldo em um instante UTC e estorno de um lançamento original                                                      |
| Mensageria        | Contadores reais de mensagens prontas, sem ack, total e DLQ; taxas do broker; intenções da sessão; repetição segura; roteiro de interrupção do worker       |
| Como testar       | Percurso de crédito, débito, repetição, saldo insuficiente, estorno e recuperação do consumo                                                                |
| Gerenciar contas  | Selecionar UUID, criar outra conta do mesmo cliente e encerrar a sessão                                                                                     |

A conta recém-criada pode retornar 404 na leitura até o primeiro evento processado. A tela informa que aguarda projeção; não inventa saldo zero de uma conta inexistente. A criação de conta **não é idempotente**: se a resposta se perder, não repita automaticamente. As contas descobertas vêm do consolidado do cliente e dos UUIDs selecionados nesta sessão; contas sem projeção precisam ser selecionadas pelo UUID retornado pela criação.

## Regras financeiras e precisão

- **Credito** entra na conta; **Debito** sai. O contrato de escrita usa essas strings, exatamente como o V2. Nas respostas, `type: 1` é crédito e `type: 2` é débito.
- `valor` deve ser positivo, com até **4 casas decimais**, sem separador de milhar. A tela aceita vírgula ou ponto decimal: `10,1234` ou `10.1234`. Rejeita zero, negativo, notação científica e quinta casa decimal.
- O dinheiro fica como string e unidades inteiras `BigInt` no frontend. O corpo HTTP contém um literal decimal JSON, preservando `NUMERIC(19,4)` até `999999999999999.9999`, sem `parseFloat` / `Number` para valores financeiros. Respostas são lidas como texto e seus campos `amount` preservados antes de `JSON.parse`.
- O saldo exibido é uma **projeção assíncrona**. O Ledger decide se existe saldo autoritativo e impede débito negativo, mesmo com leitura atrasada. A interface não debita otimisticamente.
- Estorno é **integral**, oposto e referenciado ao original: novo lançamento, sem alterar/apagar histórico. Apenas um por original; não há estorno de estorno. Se a compensação for débito, precisa de saldo. A API é a autoridade sobre essas regras, inclusive quando o original/estorno está em outra página.
- Todas as datas de consulta são UTC. Os campos de data/hora são rotulados UTC e o cliente envia ISO 8601 com `Z`.

## Roteiro de testes e payloads

Use uma conta nova para obter os valores esperados abaixo. Em uma conta já movimentada, considere o saldo inicial existente.

1. Conecte. Em **Gerenciar contas → Criar conta**, escolha a conta nova.
2. Registre crédito `100` e descrição `Depósito inicial`. Espere o saldo projetado ficar R$ 100.
3. Registre débito `30`, descrição `Compra demonstrativa`. Espere R$ 70.
4. Em Mensageria, no débito, clique **Testar repetição segura**. Deve retornar o mesmo HTTP 201, ID e sequência, com `Replayed: true`. O extrato continua com dois lançamentos e o saldo em R$ 70.
5. Tente débito `100`. Espere rejeição HTTP 409 por saldo insuficiente, preservando R$ 70.
6. No extrato, estorne o débito de 30 com motivo `Cancelamento da compra`. Espere novo crédito com `reversalOf` e saldo R$ 100. O original permanece.
7. Consulte o saldo histórico em um instante entre crédito e débito: R$ 100; entre débito e estorno: R$ 70. Use os horários UTC dos lançamentos.
8. Valide `10,1234` e rejeição de `10,12345`. O frontend rejeita a precisão inválida antes do envio; a API também valida.

Payload de crédito enviado ao Ledger:

```json
{
  "tipo": "Credito",
  "valor": 100.0,
  "descricao": "Depósito inicial",
  "referenciaExterna": "demo-credit-001"
}
```

Débito:

```json
{
  "tipo": "Debito",
  "valor": 30.0,
  "descricao": "Compra demonstrativa",
  "referenciaExterna": "demo-debit-001"
}
```

Estorno (não envie valor ou tipo):

```json
{ "motivo": "Cancelamento da compra" }
```

Exemplo pelo gateway (Bash; preencha TOKEN, ACCOUNT e ENTRY com valores reais):

```bash
curl -i -X POST "http://localhost:4200/api/ledger/api/v1/contas/$ACCOUNT/lancamentos" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: credit-demo-001' \
  -d '{"tipo":"Credito","valor":100.0000,"descricao":"Depósito inicial"}'
# Repita exatamente o mesmo comando: mesmo 201 e corpo, sem novo lançamento.
# Altere o valor mantendo a chave: HTTP 422.
curl -i -X POST "http://localhost:4200/api/ledger/api/v1/contas/$ACCOUNT/lancamentos/$ENTRY/estorno" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: reversal-demo-001' -d '{"motivo":"Cancelamento"}'
curl -H "Authorization: Bearer $TOKEN" "http://localhost:4200/api/balance/api/v1/contas/$ACCOUNT/saldo"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:4200/api/messaging"
```

Chave ausente → 400; conteúdo diferente na mesma chave → 422; intenção em andamento → 409 com `Retry-After`; regra financeira violada → 409; token inválido/expirado → 401; escopo insuficiente → 403; limite de chamadas → 429. Em timeout/502/503, a tela mantém **a mesma chave, caminho e corpo** para reenvio. Não há retry financeiro automático. O botão de repetição deve ser usado dentro da retenção de 48h; passado esse prazo o servidor pode aceitar a chave como nova. O histórico de intenções fica somente na memória da aba e não substitui o ledger/auditoria do backend. Antes de recarregar uma aba com confirmação pendente, copie a chave e o corpo para poder reconciliar a operação.

## Como ver a mensageria funcionar

Com ambos os projetos rodando, abra **Mensageria**. Na pasta `financeiro-carrefour-v2`:

```bash
docker compose stop balance-worker
```

Registre um crédito no frontend. O Ledger confirma o lançamento e o Outbox no mesmo commit. O publisher permanece na Ledger.Api: ele publica no RabbitMQ enquanto o worker está parado. Aguarde alguns segundos para as métricas de gerenciamento atualizarem. A fila `bank.balance.v1` acumula mensagens prontas; a sequência/saldo de leitura permanece anterior. Então:

```bash
docker compose start balance-worker
docker compose logs -f balance-worker
```

O consumidor atualiza projeção e inbox na mesma transação, confirma a entrega, a fila esvazia e o saldo/seq. avançam. Duplicatas não alteram saldo duas vezes. O painel compara `lastSequence` com a sequência do lançamento para marcar **Projetado**.

**Limites da observação:** o Outbox aparece como garantia transacional do backend, não como inspeção direta da tabela; os contadores RabbitMQ são **globais**, não por cliente nem por operação; não há payloads de mensagens no navegador; o frontend não afirma uma publicação individual apenas porque a fila está disponível. O worker V2 usa `BasicGet` (polling), portanto **zero consumidores push é normal**. A DLQ chama-se `bank.balance.dead.v1`. Sem credenciais ou sem broker, os contadores ficam desconhecidos (`—`), nunca zeros simulados. Não existe comando para pausar Docker pelo navegador: os botões apenas copiam comandos para o terminal.

## Por que essa arquitetura

[Decisão detalhada e diagrama](docs/architecture.md).

O Angular organiza cada tela como componente standalone e carrega as páginas sob demanda. Signals mantêm estado de sessão, conta e projeção sem introduzir uma store global complexa. Um pequeno **gateway Node sem dependências de runtime** serve os arquivos compilados, encaminha apenas os contratos permitidos e consulta métricas agregadas do broker. Isso resolve mesma origem/CORS sem mudar o V2 e mantém a senha do RabbitMQ no servidor. O gateway não implementa regra de saldo, outbox ou autenticação própria: delega a validação JWT às APIs .NET.

JWT fica somente em memória, não em localStorage, sessionStorage, URL ou cookie. Cada aba precisa reconectar após recarga. Não são registrados tokens, corpos financeiros ou senha de broker em logs do gateway. O monitor exige um Bearer autorizado pelo Balance antes de consultar as filas. Métricas globais são adequadas ao **ambiente demonstrativo local**, não a uma aplicação pública multicliente. Em produção, use política operacional própria, identidade do gateway com privilégio mínimo, HTTPS, gestão de segredos, auditoria e gateway/rate limiting de infraestrutura. O Compose publica somente em loopback e executa Node sem root, filesystem somente leitura, sem capabilities e sem socket Docker.

A política CSP permite scripts apenas da própria origem; a extração de CSS crítico está desativada para evitar handlers inline no carregamento. Estilos inline permanecem permitidos porque o Angular injeta estilos dos componentes. O proxy tem rotas permitidas, timeout, limite de corpo e não segue redirects upstream.

## Desenvolvimento e testes

Node **24.22.1** e npm **11**. Dependências fixadas por `package-lock.json`.

```bash
npm ci
npm run build
npm test
npm run test:gateway
# Backend deve estar rodando para usar dados reais:
# Bash (PowerShell: use $env:RABBITMQ_USER e $env:RABBITMQ_PASSWORD)
RABBITMQ_USER=bank RABBITMQ_PASSWORD=local-demo-rabbit-only npm start
```

`npm start` compila e serve o frontend com backend **real**. `npm run serve` serve a compilação já existente. Variáveis opcionais locais: `LEDGER_URL`, `BALANCE_URL`, `RABBITMQ_URL`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `PORT`.

`npm run dev` é uma **prévia visual isolada com fixtures**, exige build prévio e mostra banner de dados simulados. Não é integração financeira. O Docker não inclui `tools/preview.mjs`; não existe fallback silencioso de produção para fixtures.

Testes unitários verificam precisão no limite, validação, transporte HTTP, preservação de chave/corpo e estorno. Os testes do gateway verificam autorização, preservação de respostas, limite de corpo, bloqueio de rotas, falhas e proteção de credenciais. O E2E usa **PostgreSQL, RabbitMQ e backend .NET reais**: crédito, débito, replay, histórico, rejeição por saldo, estorno, pausa/retomada real do worker e layout mobile.

```bash
npx playwright install --with-deps chromium
# Backend e frontend precisam estar rodando; caminho absoluto da pasta backend:
BACKEND_DIR=/caminho/financeiro-carrefour-v2 npm run test:e2e
```

A pipeline [GitHub Actions](https://github.com/ediorhodendev/financeiro-carrefour-web/actions) executa build, testes e integração Docker. O backend é fixado no commit `bf7f02dd56e4931569273d9b4383ce8a45954081` para reprodutibilidade; atualize conscientemente após mudanças de contrato. Relatórios do navegador ficam nos artifacts da execução. Testes criam contas/lancamentos de demonstração; execute em ambiente descartável, nunca em produção.

## Estrutura

```text
src/app/core/       contratos, dinheiro, transporte HTTP, sessão e estado
src/app/pages/      overview, movements, messaging e guide
src/app/shared/     tabela, diálogo financeiro, foco acessível, ícones e fluxo
server/            gateway e testes de integração HTTP do próprio gateway
e2e/               testes de navegador com backend real
tools/             fixture explícita para revisão visual
docs/              decisões de arquitetura e limites
public/brand/      logo e atribuição
```

## Alternativas e próximos passos

NgRx e uma biblioteca grande de UI foram dispensados para manter o domínio visível e o projeto simples. Chamadas diretas ao RabbitMQ pelo browser foram descartadas porque exporiam credenciais. WebSocket/SSE foi dispensado pois o backend não oferece canal de atualização; polling moderado de 5s é suficiente para esta demonstração. Não adicionamos APIs de operação/administração Docker nem simulamos um monitor de Outbox inexistente.

Com mais tempo: autenticação OIDC com BFF e cookie HttpOnly, endpoint operacional do backend por policy, contrato OpenAPI gerado e validado no CI, SSE para posição de projeção, testes axe de acessibilidade, SLOs de lag e alertas. As melhorias de ledger (particionamento, DR e KMS) permanecem responsabilidade do backend, documentadas no V2.
