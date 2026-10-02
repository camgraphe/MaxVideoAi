import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer, connect, TLSSocket } from 'node:tls';
import test from 'node:test';
import { assertPricingCutoverTlsStream } from '../frontend/server/pricing/customer-tariff-cutover';

test('maintenance TLS proof uses the actual encrypted authorized hostname-verified socket', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cutover-tls-'));
  let server: ReturnType<typeof createServer> | undefined;
  let trusted: TLSSocket | undefined;
  let untrusted: TLSSocket | undefined;
  const peers = new Set<TLSSocket>();
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'),
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
    const certificate = readFileSync(join(directory, 'cert.pem'));
    server = createServer({ key: readFileSync(join(directory, 'key.pem')), cert: certificate }, socket => {
      peers.add(socket); socket.on('close', () => peers.delete(socket));
    });
    server.on('tlsClientError', () => undefined);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    trusted = connect({ host: '127.0.0.1', port, servername: 'localhost', ca: certificate, rejectUnauthorized: true });
    await once(trusted, 'secureConnect');
    assert.equal(trusted.authorized, true);
    assert.doesNotThrow(() => assertPricingCutoverTlsStream(trusted, 'localhost'));
    assert.throws(() => assertPricingCutoverTlsStream(trusted, 'wrong.example'), /transport|TLS/i);
    assert.throws(() => assertPricingCutoverTlsStream({ encrypted: true, authorized: true }, 'localhost'), /transport|TLS/i);
    untrusted = connect({ host: '127.0.0.1', port, servername: 'localhost', rejectUnauthorized: false });
    await once(untrusted, 'secureConnect');
    assert.equal(untrusted.authorized, false);
    assert.throws(() => assertPricingCutoverTlsStream(untrusted, 'localhost'), /transport|TLS/i);
    trusted.destroy();
    assert.throws(() => assertPricingCutoverTlsStream(trusted, 'localhost'), /transport|TLS/i);
  } finally {
    trusted?.destroy(); untrusted?.destroy();
    for (const peer of peers) peer.destroy();
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
