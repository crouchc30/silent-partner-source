#!/usr/bin/env node
/* Build blank-vault.js: empty Scot Shop books, sealed with the shared password.
 *
 *   node tools/seal-blank.mjs
 *
 * This is what the shared link opens. There are no transactions in it at all, because the point is
 * that the store manager puts her own real numbers in. What it does carry is her set-up, so she
 * isn't asked to configure anything before she can start: the cushion she keeps, how far ahead she
 * looks, how cautious to be about expected sales, what counts as an expense worth confirming, and
 * her categories. Every one of those came from her in the October 2026 session, so they are her
 * real answers rather than invented ones.
 *
 * This is the only sealed file the site ships. The sample-number demo that used to sit beside it
 * has been deleted, so that nothing in the site can show a figure nobody typed in.
 *
 * Re-sealing picks a new random salt, which is fine: the salt travels inside blank-vault.js.
 * Anyone already using their own password is unaffected, because their books live in their own
 * browser and were sealed with their own salt.
 *
 * The password is asked for, never stored. Set SP_PASSWORD to skip the prompt.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLANK_JS = path.join(ROOT, 'blank-vault.js');
const ITER = 310000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = b => Buffer.from(b).toString('base64');
const unb64 = s => Uint8Array.from(Buffer.from(s, 'base64'));
const normalize = pw => String(pw || '').trim().toLowerCase();

// Kept in step with SCOT_CATS in app.js.
const SCOT_CATS = ['Inventory', 'Supplies', 'Payroll', 'Income taxes', 'Sales taxes',
  'End-of-year distribution: Sports Club', 'End-of-year distribution: management'];

function blankBooks() {
  return {
    settings: {
      name: 'The Scot Shop',
      type: 'Nonprofit-supporting shop',
      goal: 'the end-of-year check to the Sports Club',
      reserve: 40000,   // "we've got to have a balance in there to pay payroll, to pay as we order"
      horizon: 90,      // 90 days, because the hard part of her year is the big year-end checks
      caution: 60,      // count 60% of expected sales: football season doesn't last
      big: 1500,        // confirm anything over $1,500 before it's treated as settled
      dupDays: 3,
      categories: SCOT_CATS.slice(),
      nextYearInv: 0,   // she sets this on the Sports Club page
      mgmtPct: 0,
    },
    ledger: [], nextId: 1,
    cash: [], sales: [], recurring: [], nextRecId: 1,
    mgmt: [], nextMgmtId: 1,
  };
}

async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function askPassword() {
  if (process.env.SP_PASSWORD) return Promise.resolve(process.env.SP_PASSWORD);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question('Shared password: ', a => { rl.close(); res(a); }));
}

const pw = normalize(await askPassword());
if (!pw) { console.error('A password is required.'); process.exit(1); }
const salt = crypto.getRandomValues(new Uint8Array(16));
const saltB64 = b64(salt);
const key = await keyFrom(pw, salt);

const data = blankBooks();
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
const vault = { app: 'silent-partner', v: 1, iter: ITER, salt: saltB64, iv: b64(iv), ct: b64(new Uint8Array(ct)) };

fs.writeFileSync(BLANK_JS,
  '/* Empty Scot Shop books, sealed with the shared password.\n' +
  ' * This is what the link opens: her set-up, and not one invented number.\n' +
  ' * The only sealed file the site ships. There is no sample data anywhere in it.\n' +
  ' * Regenerate with tools/seal-blank.mjs.\n' +
  ' */\n' +
  'const BLANK_VAULT = ' + JSON.stringify(vault) + ';\n');

// Prove it opens, and that it really is empty, before anyone ships it.
const back = JSON.parse(dec.decode(
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ct))));
const counts = ['ledger', 'cash', 'sales', 'recurring', 'mgmt'].map(k => [k, back[k].length]);
const notEmpty = counts.filter(([, n]) => n > 0);
if (notEmpty.length) throw new Error('blank books are not blank: ' + JSON.stringify(notEmpty));
if (JSON.stringify(back) !== JSON.stringify(data)) throw new Error('round-trip check failed');

console.log('Sealed blank-vault.js and verified the shared password reopens it.');
console.log(`Empty: ${counts.map(([k, n]) => k + ' ' + n).join(', ')}.`);
console.log(`Set up as: ${back.settings.name}, ${back.settings.reserve} cushion, ` +
  `${back.settings.horizon}-day window, ${back.settings.caution}% of sales, ` +
  `confirm over ${back.settings.big}, ${back.settings.categories.length} categories.`);
