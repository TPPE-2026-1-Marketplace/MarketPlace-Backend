const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.development');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    process.env[key] = value;
  }
}

// Testes nunca enviam e-mail de verdade, mesmo com credenciais no .env.development:
// sem a senha/refresh token, o MailService sobe desabilitado. String vazia (e não
// delete) porque alguns *.integration.ts recarregam o .env com `??=`.
process.env.SMTP_PASS = '';
process.env.GMAIL_REFRESH_TOKEN = '';

// Force the mock payment gateway to be used during tests to ensure deterministic and hermetic test runs.
process.env.PAYMENT_GATEWAY_PROVIDER = 'mock';

// Desliga o rate limiting nos testes de integração, que criam vários pedidos/
// pagamentos em sequência e estourariam o limite. O teste do 429
// (auth.throttle.spec) monta o próprio ThrottlerModule e não lê esta flag.
process.env.THROTTLE_DISABLED = 'true';

