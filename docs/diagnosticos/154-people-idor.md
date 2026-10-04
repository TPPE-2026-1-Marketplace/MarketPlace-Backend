# Diagnóstico — IDOR em `/api/people/:cpf`

> Issue: [#154](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/154)
> Issue filha coberta no mesmo PR: [#196](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/196)

## Resumo

| | |
|---|---|
| **Classe** | Broken Object Level Authorization (OWASP API1:2023) + Broken Function Level Authorization (API5:2023) |
| **Endpoints** | `GET`, `PATCH`, `DELETE /api/people/:cpf` |
| **Antes** | Qualquer cliente autenticado lia, alterava e apagava a conta de qualquer CPF |
| **Impacto confirmado** | Vazamento de dados pessoais, takeover de conta de funcionário (escalação a `gerente`), exclusão de funcionário em cascata |
| **Depois** | Cliente só acessa o próprio CPF; funcionário lê qualquer CPF; só `gerente`/`administrador` altera CPF alheio (sem `senha`/`email`); ninguém apaga CPF alheio |
| **Status** | ✅ Resolvido |

---

## Causa raiz

Os três handlers usavam apenas `@UseGuards(JwtAuthGuard)` (`src/people/people.controller.ts`): validavam que **existe** um token, mas nunca comparavam o `cpf` da rota com o `sub` (CPF) do usuário autenticado. O JWT já carrega `sub` e `role` (`src/auth/auth.service.ts`), então a informação para autorizar sempre esteve disponível — faltava a checagem.

Dois agravantes descobertos durante a reprodução:

- **Escalação de privilégio:** `UpdatePersonDto` aceita `senha` e `email`, e `PeopleService.update` aplicava sem exigir a senha atual. Um cliente redefinia a senha de um funcionário e passava a logar com o papel dele.
- **Exclusão de funcionário:** `Employee` tem `@OneToOne(() => Person, { onDelete: 'CASCADE' })` (`src/employees/entities/employee.entity.ts`). O `DELETE` apaga a `Person` e remove o funcionário (e as metas de venda) em cascata.

---

## Regra de autorização adotada

Separa leitura de escrita (princípio de menor privilégio — OWASP Authorization Cheat Sheet):

| Operação | Próprio CPF | CPF alheio |
|---|---|---|
| `GET` | todos | qualquer funcionário |
| `PATCH` | todos (todos os campos) | só `gerente`/`administrador`, exceto `senha`/`email` |
| `DELETE` | todos | ninguém |

A regra de mercado por trás de cada decisão: funcionário se **desativa** (`ativo=false`), não se apaga (padrão de offboarding — Okta/SCIM, Shopify); o titular pode excluir a própria conta (Apple 5.1.1(v), LGPD art. 18); troca de credencial não é tarefa de edição de perfil por terceiro.

A reescrita do hard delete de cliente para anonimização (LGPD/retenção fiscal) foi separada em issue própria: [#197](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/197).

---

## Metodologia

1. Subir a API localmente com Postgres isolado (`compose.dev.yml`, `PAYMENT_GATEWAY_PROVIDER=mock`) — nunca contra produção.
2. Reproduzir o ataque com requisições reais (`curl`), criando duas contas distintas e usando o token de uma contra o CPF da outra.
3. Confirmar o **efeito**, não só o status: após cada `PATCH`/`DELETE`, reconsultar para verificar se a alteração persistiu / a conta sumiu.
4. Testar os agravantes (takeover via `PATCH {senha}` + login; exclusão de funcionário via cascade) com funcionários semeados no banco.
5. Gerar evidência **simétrica** (mesmo lote antes e depois do patch), com atores recriados a cada execução para os dois lados serem independentes.

---

## Evidências

### Reprodução inicial do IDOR (código vulnerável)

Cliente A, autenticado só com o próprio token, contra o CPF do cliente B:

```
GET    /api/people/<cpf-B>            -> 200  (retornou os dados de B)
PATCH  /api/people/<cpf-B> {nome}     -> 200  (reconsulta confirmou "nome":"HACKEADO")
DELETE /api/people/<cpf-B>            -> 204
GET    /api/people/<cpf-B>            -> 404  (conta de B deixou de existir)
```

### Escalação de privilégio (código vulnerável)

```
PATCH /api/people/<cpf-gerente> {senha:"..."}   (token de cliente)  -> 200
POST  /api/auth/login  (email do gerente, senha nova)               -> 200
```

Payload do token emitido para o atacante (segunda parte do JWT, decodificada):

```json
{ "sub": "<cpf-gerente>", "email": "...", "role": "gerente", "iat": ..., "exp": ... }
```

### Exclusão de funcionário em cascata (código vulnerável)

```
antes:  SELECT role_perfil FROM employee WHERE cpf='<cpf-func>'  -> gerente
ataque: DELETE /api/people/<cpf-func>  (token de cliente)        -> 204
depois: SELECT count(*) FROM employee WHERE cpf='<cpf-func>'     -> 0
```

### Lote simétrico — antes × depois do patch

Script `scripts/evidencia-154.sh` (lote reproduzível; cria seus próprios atores a cada execução).

| # | Cenário | ANTES | DEPOIS | Prova |
|---|---|:---:|:---:|---|
| 1 | cliente A → `GET` alheio | 200 | 403 | ✅ IDOR leitura |
| 2 | cliente A → `PATCH` alheio | 200 | 403 | ✅ IDOR escrita |
| 3 | cliente A → `DELETE` alheio | 204 | 403 | ✅ IDOR exclusão |
| 4 | caixa → `PATCH` alheio | 200 | 403 | ✅ BFLA |
| 5a | cliente A → `PATCH {senha}` de gerente | 200 | 403 | ✅ Escalação |
| 5b | login como gerente c/ senha nova | 200 | 401 | ✅ Takeover efetivado × barrado |
| 6 | cliente A → `DELETE` funcionário | 204 | 403 | ✅ Cascade (#196) |
| 7 | gerente → `PATCH {nome}` alheio | 200 | 200 | ✅ Uso legítimo preservado |
| 8 | gerente → `PATCH {senha}` alheio | 200 | 403 | ✅ Campo sensível bloqueado |
| 9 | cliente A → `GET` próprio | 200 | 200 | ✅ Controle |

Os 8 cenários de ataque (1–6, 8) passaram a 403/401; os 2 de controle (7, 9) seguem 200.

---

## Correção

- `src/people/people.service.ts`: `findOne`/`update`/`remove` passam a receber o `CurrentUserPayload`; autorização checada **antes** da consulta ao banco (evita oráculo de enumeração de CPF). Checagem de `update` extraída para `assertCanUpdate`.
- `src/people/people.controller.ts`: `@CurrentUser()` injetado nos três handlers; `@ApiOperation`/`@ApiResponse(403)` atualizados.
- Testes: `people.service.spec.ts` (bloco "autorização de acesso por CPF") e `people.controller.spec.ts` cobrindo os casos negativos.

### Verificação

```
pnpm typecheck   -> ok
pnpm lint        -> ok
pnpm test        -> 436 testes, 34 suítes, todos passando
```

---

## Comparação com o resto da base

`orders` (`GET /api/orders/:id`) e `payments` já implementavam a checagem de dono corretamente (`orders.service.ts`: `if (user.role === Role.CLIENTE && order.idUsuario !== user.sub) throw ForbiddenException`). O bug era **isolado ao módulo `people`**, não um padrão sistêmico.
