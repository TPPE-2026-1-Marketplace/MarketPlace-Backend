import { maskEmail } from './mask.util';

describe('maskEmail', () => {
  it.each([
    ['maria.silva@gmail.com', 'ma***@gmail.com'],
    ['ab@dk.com', 'a***@dk.com'],
    ['a@dk.com', 'a***@dk.com'],
    ['sem-arroba', '***'],
  ])('%s → %s', (email, expected) => {
    expect(maskEmail(email)).toBe(expected);
  });
});
