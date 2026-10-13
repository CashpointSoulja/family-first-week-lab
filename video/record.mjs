// Records a real playthrough of the running app as timestamped JPEG frames with a visible pointer.
// Usage: BASE_URL=http://localhost:8787 node video/record.mjs   (requires `playwright` resolvable)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_URL || 'http://localhost:8787';
const script = JSON.parse(readFileSync(join(here, 'script.json'), 'utf8'));
const durs = JSON.parse(readFileSync(join(here, 'out/vo/durations.json'), 'utf8'));
const framesDir = join(here, 'out/frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const { width, height, dpr } = script.viewport;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
await page.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const p = document.createElement('div');
    p.id = 'demo-pointer';
    p.setAttribute('aria-hidden', 'true');
    Object.assign(p.style, { position: 'fixed', left: '-40px', top: '-40px', width: '22px', height: '22px', borderRadius: '50%',
      background: 'rgba(30,48,58,0.85)', border: '3px solid #fff', boxShadow: '0 0 0 2px #1e303a', zIndex: '99999', pointerEvents: 'none',
      transform: 'translate(-50%,-50%)', transition: 'background 120ms' });
    document.body.appendChild(p);
    addEventListener('mousemove', (e) => { p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { p.style.background = '#feed9d'; p.style.boxShadow = '0 0 0 3px #ff595a'; }, true);
    addEventListener('mouseup', () => setTimeout(() => { p.style.background = 'rgba(30,48,58,0.85)'; p.style.boxShadow = '0 0 0 2px #1e303a'; }, 180), true);
  });
});
await page.goto(base + '/#/start');
await page.waitForSelector('body[data-lab="ok"]');
await page.waitForTimeout(800);

const frames = [];
let recording = true;
let paused = false;
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const loop = (async () => {
  let n = 0;
  while (recording) {
    if (paused) { await new Promise((r) => setTimeout(r, 5)); continue; }
    const t = now();
    const file = join(framesDir, `f${String(n++).padStart(5, '0')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    frames.push({ t, file });
  }
})();
const shot = async () => { const t = now(); const file = join(framesDir, `s${String(frames.length).padStart(5, '0')}-${Math.round(t * 1000)}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 88 }); frames.push({ t, file }); };

let mx = width / 2, my = height / 2;
async function moveTo(x, y) {
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await page.mouse.move(mx + (x - mx) * e, my + (y - my) * e);
    await page.waitForTimeout(22);
  }
  mx = x; my = y;
}
async function visible(sel) {
  const loc = page.locator(sel).filter({ visible: true }).first();
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  return loc;
}
async function smoothScrollTo(targetY) {
  paused = true;
  const start = await page.evaluate(() => scrollY);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const end = Math.max(0, Math.min(max, targetY));
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await page.evaluate((y) => new Promise((r) => { scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(r)); }), start + (end - start) * e);
    await shot();
  }
  paused = false;
}
async function scrollToSel(sel) {
  const loc = await visible(sel);
  const box = await loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  const cur = await page.evaluate(() => scrollY);
  const topLimit = cur + 70, bottomLimit = cur + height - 90;
  if (box.top >= topLimit && box.top + box.h <= bottomLimit) return;
  await smoothScrollTo(box.top - 110);
}
async function run([kind, a, b]) {
  if (kind === 'goto') { await page.goto(base + a); await page.waitForSelector('body[data-lab="ok"]'); await page.waitForTimeout(300); return; }
  if (kind === 'reload') { await page.reload(); await page.waitForSelector('body[data-lab="ok"]'); await page.waitForTimeout(400); return; }
  if (kind === 'wait') { await page.waitForTimeout(a); return; }
  if (kind === 'scrollBy') { const y = await page.evaluate(() => scrollY); await smoothScrollTo(y + a); return; }
  if (kind === 'scrollTo') { await scrollToSel(a); return; }
  const loc = await visible(a);
  if (!a.startsWith('.steps')) await scrollToSel(a);
  const bb = await loc.boundingBox();
  await moveTo(bb.x + Math.min(bb.width / 2, 40), bb.y + bb.height / 2);
  if (kind === 'click') { await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); }
  if (kind === 'select') { await loc.focus(); await loc.selectOption(b); }
  await page.waitForTimeout(250);
}

const log = [];
for (const s of script.scenes) {
  const start = now();
  const vo = s.phrases.reduce((a, _p, i) => a + durs[`${s.id}-${i}`] + 0.18, 0);
  const actions = (async () => { for (const a of s.actions) await run(a); })();
  let t = start;
  s.phrases.forEach((p, i) => { log.push({ scene: s.id, i, start: t, dur: durs[`${s.id}-${i}`], cap: p.cap, say: p.say }); t += durs[`${s.id}-${i}`] + 0.18; });
  await actions;
  const remaining = start + vo + 0.12 - now();
  if (remaining > 0) await page.waitForTimeout(remaining * 1000);
  const over = now() - (start + vo + 0.12);
  if (over > 0.5) console.warn(`scene ${s.id}: actions outlasted narration by ${over.toFixed(2)}s`);
}
await page.waitForTimeout(600);
recording = false;
await loop;
const end = now();
await browser.close();
frames.sort((a, b) => a.t - b.t);
writeFileSync(join(here, 'out/timeline.json'), JSON.stringify({ end, frames: frames.map((f) => ({ t: +f.t.toFixed(3), file: f.file.split('/').pop() })), phrases: log }, null, 1));
console.log(`recorded ${frames.length} frames over ${end.toFixed(1)}s (${(frames.length / end).toFixed(1)} fps)`);
