// scripts/vapid.mjs - Generate the VAPID keypair that lets the Worker send web-push reminders.
//   node scripts/vapid.mjs
// Writes the private key to .secrets/vapid-private.json (git-ignored) and prints the public key.
// Refuses to overwrite an existing key: replacing it would silently cancel every subscription.
import { webcrypto as crypto } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.secrets', 'vapid-private.json');
if (existsSync(file)) {
  console.error(`${file} already exists; delete it first only if you really want a new key.`);
  process.exit(1);
}

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)); // 65 bytes, uncompressed point
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(jwk), { mode: 0o600 });

console.log('Public key (goes in core/pwa.ts and worker/wrangler.toml):');
console.log(b64url(raw));
console.log('\nStore the private key as a Worker secret:');
console.log('  cd worker && npx wrangler secret put VAPID_PRIVATE_JWK < ../.secrets/vapid-private.json');
