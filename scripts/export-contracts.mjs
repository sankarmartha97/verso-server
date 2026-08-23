// Sanity check for the contracts pipeline: confirms every schema file in
// src/contracts/schemas/ actually exports Zod schemas (objects with .parse).
// This repo's schemas are already the source of truth, so "export" here means
// "prove what verso-client's pull-contracts.mjs is about to copy is valid" —
// there's no format transform, just a shape check.
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.join(__dirname, '..', 'src', 'contracts', 'schemas');

const files = readdirSync(schemasDir).filter((file) => file.endsWith('.js'));

if (files.length === 0) {
  console.error(`No schema files found in ${schemasDir}`);
  process.exit(1);
}

let ok = true;
for (const file of files) {
  const exports = require(path.join(schemasDir, file));
  const names = Object.keys(exports);
  const invalid = names.filter((name) => typeof exports[name]?.parse !== 'function');
  if (invalid.length > 0) {
    ok = false;
    console.error(`${file}: not valid Zod schemas: ${invalid.join(', ')}`);
  } else {
    console.log(`${file}: ${names.join(', ')}`);
  }
}

if (!ok) process.exit(1);
console.log(`${files.length} contract file(s) OK — ready for verso-client's contracts:pull`);
