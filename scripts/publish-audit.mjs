// Pre-publish audit: fails if tracked files or the built site contain tool/agent bylines or machine paths.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Term list is base64-encoded so this file doesn't match its own scan.
const terms = Buffer.from('ZGV2aW58Y2xhdWRlfGFudGhyb3BpY3xvcGVuYWl8Y2hhdGdwdHxncHQtfGNvcGlsb3R8Y3Vyc29yfHdpbmRzdXJmfGdlbWluaXxsbG18b3B1c3xzb25uZXR8Y28tYXV0aG9yZWQtYnl8Z2VuZXJhdGVkIGJ5IGFpfG1hZGUgd2l0aCBhaXwvaG9tZS91YnVudHV8L29wdC8=', 'base64').toString('utf8').split('|');
const re = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).map((t) => (/^[a-z]{3,4}$/.test(t) ? `\\b${t}\\b` : t)).join('|'), 'i');

const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
if (existsSync('dist')) {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  files.push(...walk('dist'));
}
const hits = [];
for (const f of files) {
  if (f === 'scripts/publish-audit.mjs' || f === 'package-lock.json') continue;
  if (/\.woff2?$/i.test(f)) continue; // unmodified third-party font binaries
  if (/\.(png|jpe?g|mp4|wav|webm|avif|ico)$/i.test(f)) {
    const m = readFileSync(f).toString('latin1').match(re);
    if (m) hits.push(`${f} (binary bytes): ${m[0]}`);
    continue;
  }
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => { const m = l.match(re); if (m) hits.push(`${f}:${i + 1}: ${m[0]}`); });
}
const log = execSync('git log --format=%an%x09%ae%x09%B', { encoding: 'utf8' });
for (const l of log.split('\n')) { const m = l.match(re); if (m) hits.push(`git log: ${m[0]}`); }
if (hits.length) { console.error('Publish audit FAILED\n' + hits.join('\n')); process.exit(1); }
console.log(`Publish audit passed: ${files.length} files and git history clean.`);
