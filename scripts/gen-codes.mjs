// Generates unique activation codes in the MDLY-XXXX-XXXX format used by
// src/activation.ts and the worker. Run: node scripts/gen-codes.mjs [count]
//
// Output files (git-ignored — these are real activation codes, never commit
// them):
//   codes-batch-N.csv       — for your own records / printing on boxes
//   codes-batch-N-seed.json — for `wrangler kv bulk put` to seed the worker's KV
import { writeFileSync, existsSync } from 'node:fs';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

function randomChar() {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

function checksumChar(payload) {
  let sum = 0;
  for (const ch of payload) sum += ALPHABET.indexOf(ch);
  return ALPHABET[sum % ALPHABET.length];
}

function generateCode() {
  let payload = '';
  for (let i = 0; i < 7; i++) payload += randomChar();
  const body = payload + checksumChar(payload); // 8 chars total
  return `MDLY-${body.slice(0, 4)}-${body.slice(4)}`;
}

const count = Number(process.argv[2]) || 200;
const codes = new Set();
while (codes.size < count) codes.add(generateCode());
const list = [...codes];

let batch = 1;
while (existsSync(`codes-batch-${batch}.csv`)) batch++;

const csvPath = `codes-batch-${batch}.csv`;
const seedPath = `codes-batch-${batch}-seed.json`;

writeFileSync(csvPath, ['code', ...list].join('\n'));

const seed = list.map((code) => ({ key: code, value: JSON.stringify({ devices: [] }) }));
writeFileSync(seedPath, JSON.stringify(seed, null, 2));

console.log(`Generated ${list.length} unique codes.`);
console.log(`  ${csvPath}  (for your records)`);
console.log(`  ${seedPath}  (for: wrangler kv bulk put ${seedPath} --namespace-id=<id>)`);
