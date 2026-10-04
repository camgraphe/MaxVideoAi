import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMailerConfig } from '../frontend/server/mailer-config';

const credentials = { BREVO_SMTP_USERNAME: 'smtp-login', BREVO_SMTP_PASSWORD: 'test-secret' };

test('application mail accepts EMAIL_FROM when the contact override is absent', () => {
  const config = resolveMailerConfig({ ...credentials, EMAIL_FROM: 'MaxVideoAI <support@example.com>' });
  assert.equal(config?.from, 'MaxVideoAI <support@example.com>');
  assert.equal(config?.host, 'smtp-relay.sendinblue.com');
  assert.equal(config?.port, 587);
});

test('contact sender has precedence and SMTP login never becomes the sender', () => {
  assert.equal(resolveMailerConfig(credentials), null);
  assert.equal(resolveMailerConfig({ ...credentials, EMAIL_FROM: 'fallback@example.com', CONTACT_SENDER_EMAIL: 'contact@example.com' })?.from, 'contact@example.com');
});

test('incomplete credentials and invalid ports fail closed', () => {
  assert.equal(resolveMailerConfig({ EMAIL_FROM: 'sender@example.com' }), null);
  for (const port of ['NaN', '0', '65536', '587.5']) {
    assert.equal(resolveMailerConfig({ ...credentials, EMAIL_FROM: 'sender@example.com', BREVO_SMTP_PORT: port }), null);
  }
});
