# Dependências centrais — decisão de versionamento

Registro da decisão sobre a issue #172 (dívida técnica: `typeorm` e
`typescript` atrás do major mais recente).

## Situação verificada

| Pacote | Versão no `package.json` | Major mais recente disponível |
| --- | --- | --- |
| `typeorm` | `^0.3.24` (lockfile resolve `0.3.28`) | `1.1.1` |
| `typescript` | `^5.7.3` | `5.x` segue sendo o major atual; o range já resolve `5.9.x` via lockfile — não há salto de major pendente aqui, só minor/patch. |

Não é vulnerabilidade de segurança conhecida — `pnpm audit` não acusa nada
para essas versões. É dívida técnica de atualização, como descrito na issue.

## Decisão

**Não migrar agora.** Ficar na major atual do TypeORM (`0.3.x`) enquanto o
time está em desenvolvimento ativo do backend. Motivo: TypeORM 0.3 → 1.x é
um salto de major com breaking changes de API prováveis (a própria issue
recomenda ler o changelog antes de migrar) — arriscar isso em paralelo com
entregas de feature ativas custa mais do que vale agora.

`typescript` não precisa de decisão separada: o range `^5.7.3` já resolve a
versão mais nova do major atual (`5.9.x`) automaticamente via lockfile.

## Quando revisitar

Reavaliar a migração do TypeORM quando o desenvolvimento de features
estiver estabilizado (pós-entrega da disciplina) e houver uma janela para:

1. Ler o changelog de breaking changes do TypeORM 0.3 → 1.x.
2. Migrar em um branch dedicado, rodando a suíte de testes completa
   (`make dev-test-cov`) a cada mudança de API.

Relacionado: issue #172.
