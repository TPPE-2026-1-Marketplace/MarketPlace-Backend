# Diagnóstico — exclusão de cliente com pedidos (hard delete → anonimização)

## Resumo

| | |
|---|---|
| **Classe** | Ciclo de vida de dados pessoais (LGPD art. 16 e 18, VI) + integridade referencial |
| **Endpoint** | `DELETE /api/people/:cpf` (só o dono, regra da #154) |
| **Antes** | Cliente com pedido não conseguia excluir a conta: a FK `orders.id_usuario` (`ON DELETE RESTRICT`) derrubava o `DELETE` e a API respondia **500** |
| **Depois** | Sem pedidos → exclusão. Pedido em andamento → **409**. Só pedidos encerrados → dados pessoais anonimizados, pedido preservado |
| **Schema** | Sem migration — nenhuma coluna nova |
| **Status** | ✅ Resolvido |

## Causa raiz

`PeopleService.remove` fazia `peopleRepository.delete({ cpf })`. A `Person` é referenciada por:

| Tabela | FK | Efeito do `DELETE person` |
|---|---|---|
| `orders.id_usuario` | `RESTRICT` | **bloqueia** → `QueryFailedError` → 500 |
| `address.cpf_pessoa` | `CASCADE` | apaga endereços |
| `review.cpf_cliente` | `CASCADE` | apaga reviews |
| `employee.cpf` | `CASCADE` | apaga o funcionário |

Além da FK, o pedido guarda um **snapshot pessoal** próprio (telefone, endereço completo e, em vendas de loja, nome/CPF/email avulsos). Apagar só a `Person` não removeria esses dados.

## Regra adotada

| Situação do titular | Comportamento | Justificativa |
|---|---|---|
| Sem pedidos | hard delete (como antes) | Sem base legal para reter: eliminação é a regra (LGPD art. 16) |
| Algum pedido `pending`, `paid` ou `shipped` | **409 Conflict**, nada é alterado | A entrega ainda depende do endereço/contato; `pending` expira pelo webhook de pagamento |
| Só pedidos `delivered`/`cancelled` | **anonimização** em uma transação | Retenção fiscal do pedido (CTN art. 173, 5 anos) sem manter o dado pessoal |

### O que a anonimização faz

1. Cria uma `Person` pseudônima: CPF `X` + 10 hex aleatórios (cabe em `varchar(11)` e nunca colide com CPF real, que só tem dígitos), nome `Cliente removido`, email `<pseudônimo>@anonimizado.invalid` (TLD reservado, RFC 2606), sem telefone e sem senha (não faz login).
2. Re-aponta os pedidos do titular para o pseudônimo e apaga o snapshot pessoal: telefone, CEP, rua, número, complemento, bairro e campos avulsos. **Mantém** itens, valores, datas, status, cidade e UF.
3. Redige também pedidos de loja feitos com o CPF como avulso (`cliente_cpf_avulso`).
4. Apaga a `Person` original (endereços e reviews caem em cascata).

### Decisões e alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Anonimizar a `Person` mantendo o CPF | CPF é dado pessoal. E `registerUser` "completa" um cadastro existente sem senha: quem soubesse o CPF recriaria a conta e herdaria o histórico de pedidos |
| `orders.id_usuario = NULL` | `payments.service` trata `idUsuario = null` como **pedido de convidado**, pagável sem JWT. Mudaria a semântica do pedido |
| Coluna `anonimizado_em` | Exige migration, que roda no start do container (`scripts/start-prod.sh`) — risco de deploy desnecessário. O domínio `anonimizado.invalid` já identifica o pseudônimo |

Pseudônimos ficam fora da listagem (`GET /api/people`) e do export CSV.

## Metodologia

Lote simétrico via HTTP contra a API dev (`make dev-up`), com `scripts/evidencia-197.sh`: o mesmo script roda com o código antigo (`ANTES`) e depois do patch (`DEPOIS`). Cada execução cria os próprios titulares e pedidos, então não é preciso resetar o banco entre as duas. Também cobre o caso por teste de integração (`src/people/people-anonymization.integration.ts`), contra Postgres real.

## Evidências

### Antes (hard delete)

```
<colar aqui a saída de: bash scripts/evidencia-197.sh ANTES>
```

```
<colar aqui o trecho do log da API com o QueryFailedError de FK (make dev-logs)>
```

### Depois (anonimização)

```
<colar aqui a saída de: bash scripts/evidencia-197.sh DEPOIS>
```

### Lote simétrico

| # | Cenário | ANTES | DEPOIS | Prova |
|---|---|:---:|:---:|---|
| 1 | DELETE próprio, sem pedidos | 204 | 204 | Controle |
| 2 | DELETE próprio, pedido entregue | 500 | 204 | A FK não estoura mais |
| 3 | DELETE próprio, pedido pago | 500 | 409 | Entrega em curso protegida |
| 4–9 | Estado do pedido (2) | person mantida, dados pessoais no pedido | person apagada, pedido preservado e anonimizado | Retenção fiscal sem dado pessoal |
| 10 | Login do titular (2) | 200 | 401 | Conta efetivamente encerrada |
| 11–12 | Titular (3) e pedido após 409 | intactos | intactos | Nada alterado na recusa |

## Verificação

```
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build   # <resultado>
pnpm test:cov                                                    # <suítes/testes>
```

## Fora de escopo

- Funcionário que exclui o próprio cadastro continua apagando o `employee` em cascata (comportamento anterior, ver #196).
- Pedido `pending` que nunca recebe webhook bloquearia a exclusão; depende da expiração do link de pagamento.
