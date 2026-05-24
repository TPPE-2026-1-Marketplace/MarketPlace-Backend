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

// Force the mock payment gateway to be used during tests to ensure deterministic and hermetic test runs.
process.env.PAYMENT_GATEWAY_PROVIDER = 'mock';

