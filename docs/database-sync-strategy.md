# Estratégia de sincronização de schema (issue #157)

## Problema

O TypeORM está configurado com `synchronize: !isProduction`
(`src/app.module.ts`): em dev (e nos testes de integração, que sobem a
`AppModule` com `NODE_ENV=test`), o schema do banco é auto-sincronizado com
as entities a cada boot, sem passar pelas migrations versionadas.

Isso tem dois efeitos:

1. **Perda de dado silenciosa em dev**: mudanças de tipo/constraint podem
   fazer o TypeORM recriar uma coluna (drop + create) em vez de alterá-la,
   apagando dados locais sem aviso.
2. **Drift entre entities e migrations**: como o schema de dev nunca depende
   das migrations pra funcionar, é possível (e aconteceu) mudar uma entity
   sem nunca gerar a migration correspondente. Ninguém percebe, porque dev e
   CI usam `synchronize` e "consertam" o schema sozinhos — só produção, que
   roda exclusivamente migrations, ficaria com o schema desatualizado.

## Diff identificado

Metodologia: subimos um Postgres isolado e descartável, aplicamos **só** a
migration `1781916000000-InitialSchema` (sem `synchronize`), e rodamos
`pnpm migration:generate` contra esse banco — isso faz o TypeORM comparar o
schema real com as entities atuais e listar as diferenças.

**Ruído cosmético (sem risco):** a maior parte do diff é renomeação de
constraint — a migration baseline usa nomes manuais (`fk_employee_person`,
`chk_review_nota`, ...), enquanto o TypeORM, sem nome explícito no decorator,
gera hashes (`FK_cc5bc3cbcb...`). Mesmo efeito, nome diferente. Idem para
formatação de default (`now()` vs `CURRENT_TIMESTAMP`, ambos equivalentes).

**Drift real (corrigido pela migration
`1789415864466-FixOrdersGuestCheckoutAndSalesGoalBonusColumn`):**

| Tabela       | O que estava faltando                                                                                                                                                                                                                                                                                                       | Origem                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `sales_goal` | Coluna `taxa_comissao_bonus` renomeada para `valor_bonus` na entity, sem migration                                                                                                                                                                                                                                          | —                                                                                                                                 |
| `orders`     | 11 colunas do fluxo de "cliente avulso" (venda presencial sem cadastro) + snapshot de endereço: `cliente_nome_avulso`, `cliente_cpf_avulso`, `cliente_email_avulso`, `cliente_telefone`, `endereco_cep`, `endereco_rua`, `endereco_numero`, `endereco_complemento`, `endereco_bairro`, `endereco_cidade`, `endereco_estado` | Adicionadas na entity em 2026-06-22 (commit `6d24e74`, "fix: cashier login") — um dia depois da `InitialSchema`, e nunca migradas |

O commit que adicionou as colunas de `orders` já está em `main`. Como
produção só aplica migrations (não usa `synchronize`), é provável que a
tabela `orders` em produção não tenha essas 11 colunas até esta correção ser
deployada — nenhum cliente real usa o sistema ainda, então não houve impacto
em produção, mas o fluxo de cliente avulso quebraria (erro de SQL) assim que
fosse exercitado.

Depois de aplicar a migration de correção, rodamos `migration:generate`
novamente: o diff restante foi só o ruído de nome de constraint descrito
acima — nenhuma tabela, coluna ou tipo real faltando.

## Decisão

**Manter `synchronize: true` em dev.** Desligar exigiria que as 9 pessoas do
time passassem a rodar `migration:run` manualmente a cada mudança de
entity — mudança de processo grande demais frente ao ganho, considerando que
produção já é isolada (roda só migrations, `synchronize: false` hardcoded em
`src/database/data-source.ts`) e não é afetada pelo comportamento de dev.

**Mitigação adotada nesta issue:** migration de correção fechando o drift
identificado acima.

**Não implementado nesta issue (fica como melhoria futura):** um passo no CI
que rode `migration:generate` contra um banco limpo e falhe o PR se detectar
diff pendente — isso obrigaria toda mudança de entity a vir acompanhada da
migration correspondente, fechando o ciclo sem exigir desligar `synchronize`
em dev.

## Recomendação prática pro time

Ao adicionar/renomear uma coluna numa entity, gerar a migration
correspondente no mesmo PR (`pnpm migration:generate src/database/migrations/NomeDaMudanca`
contra um banco com só as migrations aplicadas — não contra o banco de dev,
que já está com `synchronize` aplicado e não vai detectar diff nenhum).
