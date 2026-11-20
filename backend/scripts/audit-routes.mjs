// GEN-13: lists every route and flags the ones without @Auth(...).
// Run from the project root: node backend/scripts/audit-routes.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.controller.ts')) files.push(p);
  }
};
walk(src);

const open = [];
let total = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  // A file can hold several controller classes; class decorators start at column 0
  let pendingBase = '';
  let pendingAuth = null;
  let base = '';
  let classAuth = null;
  let classStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ctrl = line.match(/^@Controller\(\s*(?:'([^']*)')?/);
    if (ctrl) { pendingBase = ctrl[1] || ''; continue; }
    const cauth = line.match(/^@Auth\(([^)]*)\)/);
    if (cauth) { pendingAuth = cauth[1] || 'any'; continue; }
    if (/^export class/.test(line)) {
      base = pendingBase; classAuth = pendingAuth; classStart = i;
      pendingBase = ''; pendingAuth = null;
      continue;
    }
    const m = line.match(/^\s+@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?/);
    if (!m) continue;
    total++;
    const block = [];
    let j = i;
    while (j < lines.length && !/^\s*(async\s+)?[A-Za-z_]\w*\s*\(/.test(lines[j])) block.push(lines[j++]);
    for (let k = i - 1; k > classStart && /^\s+@/.test(lines[k]); k--) block.push(lines[k]);
    const auth = block.join(' ').match(/@Auth\(([^)]*)\)/);
    const path = '/' + ['api', base, m[2]].filter(Boolean).join('/');
    const route = `${m[1].toUpperCase().padEnd(6)} ${path}`;
    const where = file.slice(src.length + 1) + ':' + (i + 1);
    if (auth) console.log(`  ok    ${route.padEnd(62)} @Auth(${auth[1] || 'any'})`);
    else if (classAuth) console.log(`  ok    ${route.padEnd(62)} @Auth(${classAuth}) on class`);
    else { console.log(`  OPEN  ${route.padEnd(62)} ${where}`); open.push(`${route.padEnd(62)} ${where}`); }
  }
}
console.log(`\n${total} routes, ${open.length} without @Auth (check each one below is meant to be public):`);
open.forEach((r) => console.log('  ' + r));
