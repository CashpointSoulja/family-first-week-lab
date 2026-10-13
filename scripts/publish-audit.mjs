// Pre-publish audit: fails if tracked files or the built site contain tool/agent bylines or machine paths.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const terms = [
  ['de', 'vin'], ['cla', 'ude'], ['anth', 'ropic'], ['open', 'ai'], ['chat', 'gpt'], ['gp', 't-'], ['co', 'pilot'], ['cur', 'sor'],
  ['wind', 'surf'], ['gem', 'ini'], ['ll', 'm'], ['op', 'us'], ['son', 'net'], ['co-authored', '-by'], ['generated', ' by ai'], ['made with ', 'ai'],
  ['/home/', 'ubuntu'], ['/o', 'pt/'],
].map((p) => p.join(''));
const re = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).map((t) => (t === 'llm' || t === 'opus' ? `\\b${t}\\b` : t)).join('|'), 'i');

const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
if (existsSync('dist')) {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  files.push(...walk('dist'));
}
const hits = [];
for (const f of files) {
  if (/\.(png|jpe?g|woff2?|mp4|wav|webm|avif|ico)$/i.test(f) || f === 'scripts/publish-audit.mjs' || f === 'package-lock.json') continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => { const m = l.match(re); if (m) hits.push(`${f}:${i + 1}: ${m[0]}`); });
}
const log = execSync('git log --format=%an%x09%ae%x09%B', { encoding: 'utf8' });
for (const l of log.split('\n')) { const m = l.match(re); if (m) hits.push(`git log: ${m[0]}`); }
if (hits.length) { console.error('Publish audit FAILED\n' + hits.join('\n')); process.exit(1); }
console.log(`Publish audit passed: ${files.length} files and git history clean.`);
