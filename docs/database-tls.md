# Verificação de certificado TLS na conexão com o banco — decisão

A conexão com o Postgres em produção usa TLS, mas (até esta decisão) com
`rejectUnauthorized: false` — ou seja, a conexão é criptografada, mas o
cliente não valida se o certificado apresentado pelo servidor é legítimo
(vulnerável a man-in-the-middle entre a API e o banco). Essa configuração
não tinha nenhuma justificativa registrada, e é o tipo de ajuste que
ferramentas de auditoria de segurança sinalizam por padrão (issue #171).

## Por que não foi simplesmente ativado

Provedores de Postgres gerenciado (caso do Neon, usado neste projeto — ver
`docs/cd.md`) normalmente emitem certificado a partir de uma CA pública, o
que tornaria a verificação real (`rejectUnauthorized: true`) possível sem
precisar carregar um certificado de CA customizado. Mas não há como
confirmar isso a partir do ambiente de desenvolvimento — exigiria testar
contra a conexão real de produção. Trocar o padrão sem essa validação
arriscaria derrubar a conexão com o banco em produção, sem rollback rápido
(o deploy seguinte precisaria reverter o código).

## Decisão registrada

Comportamento passa a ser **configurável, com o padrão atual preservado**:

- **Fora de produção:** TLS desligado (`ssl: false`), sem mudança.
- **Em produção, por padrão:** mantém `rejectUnauthorized: false` — o
  comportamento de hoje, sem risco de regressão.
- **Em produção, com `DATABASE_SSL_VERIFY=true`:** ativa a verificação real
  do certificado (`rejectUnauthorized: true`), usando a cadeia de CAs
  confiáveis padrão do Node — suficiente se o certificado do provedor for
  emitido por uma CA pública, sem precisar de bundle de CA customizado.

Implementado em `buildDatabaseSslConfig()`
(`src/database/connection-config.ts`), usado tanto no `TypeOrmModule`
(runtime) quanto no `DataSource` de migrations — antes a mesma lógica
estava duplicada manualmente nos dois lugares.

## Como fechar a verificação de vez

Quando alguém com acesso ao ambiente de produção puder validar a mudança:

1. Definir `DATABASE_SSL_VERIFY=true` no ambiente de produção (Render).
2. Fazer o deploy e confirmar que a API conecta normalmente ao banco
   (`GET /api/health/ready`).
3. Se a conexão falhar por certificado não reconhecido, o provedor usa uma
   CA não presente no bundle padrão do Node — nesse caso, seria necessário
   carregar o certificado da CA do provedor explicitamente (`ca` na opção
   `ssl`), o que não foi implementado aqui por falta de necessidade
   confirmada.

Relacionado: issue #171.
