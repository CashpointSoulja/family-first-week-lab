import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ALL = ['drinks', 'meals', 'outside', 'wake', 'night', 'bathroom'];

test.beforeEach(async ({ page }, info) => {
  const ms = Number(info.project.metadata?.latencyMs ?? 0);
  if (ms > 0) await page.route('**/api/**', async (r) => { await new Promise((res) => setTimeout(res, ms)); await r.fallback(); });
});

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector('body[data-lab="ok"]');
}
/** The pending notice is drawn synchronously on click, so once it is gone the server has answered and the screen shows that answer. */
async function settled(page: Page) {
  await expect(page.locator('#api-pending')).toHaveCount(0);
}
async function invite(page: Page) {
  await open(page, '/#/start');
  await page.getByRole('button', { name: /Continue to consent/ }).click();
  await page.locator('#send-invite').click();
  await settled(page);
  await expect(page.locator('#as-monitored')).toBeVisible();
}
async function acceptAs(page: Page, cats = ALL) {
  await page.locator('#as-monitored').click();
  for (const c of cats) await page.check(`input[value=${c}]`);
  await page.getByRole('button', { name: "Share what I've chosen" }).click();
  await settled(page);
}
async function pickScenario(page: Page, id: string) {
  await open(page, '/#/lab');
  await page.selectOption('#scenario-lab', id);
  await settled(page);
  await expect.poll(async () => (await lab(page)).scenario).toBe(id);
}
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
}

test('1 start: fictional household, relationship, goal, simulated-data explainer', async ({ page }) => {
  await open(page, '/');
  await expect(page.locator('main').getByText('Fern Cottage (fictional)')).toBeVisible();
  await expect(page.getByText("What's simulated here")).toBeVisible();
  await page.check('input[value=hh-harbour]');
  await page.selectOption('#relationship', 'grandchild');
  await page.check('input[value=coordinate]');
  await expect(page.locator('footer')).toContainText('Independent concept by Ayo Ahmed');
  await expect(page.locator('footer')).toContainText('Not affiliated');
  await expect(page.locator('img[alt="Lilli logo"]')).toBeVisible();
  await axe(page);
});

test('2 consent: pending blocks data; no bypass via direct routes', async ({ page }) => {
  await invite(page);
  await expect(page.getByText('Pending: waiting for their answer')).toBeVisible();
  await open(page, '/#/today');
  await expect(page.getByRole('heading', { name: 'Waiting for consent' })).toBeVisible();
  await expect(page.locator('.reading')).toHaveCount(0);
  await open(page, '/#/week');
  await expect(page.locator('[data-weekly=locked]')).toBeVisible();
  await open(page, '/#/setup');
  await expect(page.getByText(/Paused until Grace says yes/)).toBeVisible();
  await expect(page.locator('#to-today')).toBeDisabled();
  await open(page, '/#/consent');
  await axe(page);
});

test('2 consent: accept needs a choice, granular sharing respected', async ({ page }) => {
  await invite(page);
  await page.locator('#as-monitored').click();
  await expect(page.getByText('Viewing as')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: "Share what I've chosen" }).click();
  await expect(page.getByRole('alert')).toContainText('Choose at least one');
  await page.check('input[value=drinks]');
  await page.check('input[value=meals]');
  await page.getByRole('button', { name: "Share what I've chosen" }).click();
  await expect(page.getByRole('heading', { name: /said yes to 2 of 6/ })).toBeVisible();
  await open(page, '/#/today');
  await expect(page.locator('.reading[data-state=notShared]')).toHaveCount(4);
});

test('2 consent: decline shares nothing; ask again returns to pending', async ({ page }) => {
  await invite(page);
  await page.locator('#as-monitored').click();
  await page.locator('#decline').click();
  await expect(page.getByRole('heading', { name: 'Grace said no' })).toBeVisible();
  await open(page, '/#/today');
  await expect(page.getByRole('heading', { name: 'Waiting for consent' })).toBeVisible();
  await open(page, '/#/consent');
  await axe(page);
  await page.getByRole('button', { name: /Ask again/ }).click();
  await expect(page.getByText('Pending: waiting for their answer')).toBeVisible();
});

test('2 consent: revoke one area then everything; insights disappear', async ({ page }) => {
  await invite(page);
  await acceptAs(page);
  await page.locator('#as-monitored').click();
  await page.getByRole('button', { name: 'Stop sharing bathroom visits' }).click();
  await page.locator('#as-family').click();
  await open(page, '/#/today');
  await expect(page.locator('.reading[data-cat=bathroom]')).toHaveAttribute('data-state', 'notShared');
  await open(page, '/#/consent');
  await page.locator('#as-monitored').click();
  await page.locator('#revoke-all').click();
  await expect(page.getByRole('heading', { name: 'Grace turned sharing off' })).toBeVisible();
  await open(page, '/#/today');
  await expect(page.getByRole('heading', { name: 'Sharing has been turned off' })).toBeVisible();
  await expect(page.locator('.reading')).toHaveCount(0);
  await open(page, '/#/week');
  await expect(page.locator('[data-weekly=locked]')).toBeVisible();
});

test('3 setup: readiness counts only shared sensors; pairing simulated', async ({ page }) => {
  await pickScenario(page, 'day0');
  await invite(page);
  await acceptAs(page);
  await page.locator('#to-setup').click();
  await expect(page.getByRole('heading', { name: '5 of 7 needed sensors reporting' })).toBeVisible();
  await expect(page.getByText('Not paired')).toBeVisible();
  await expect(page.getByText('Waiting for first event')).toBeVisible();
  await axe(page);
  const toPair = await page.locator('[data-sensor-status=notPaired]').getAttribute('data-sensor');
  await page.locator(`[data-pair="${toPair}"]`).click();
  await expect(page.locator(`[data-sensor="${toPair}"]`)).toHaveAttribute('data-sensor-status', 'waiting');
  for (let i = 0; i < 2; i++) {
    const btn = page.getByRole('button', { name: 'Send test event (simulated)' }).first();
    const sensor = await btn.getAttribute('data-test');
    await btn.click();
    await expect(page.locator(`[data-sensor="${sensor}"]`)).toHaveAttribute('data-sensor-status', 'ready');
  }
  await expect(page.getByRole('heading', { name: '7 of 7 needed sensors reporting' })).toBeVisible();
  await expect(page.locator('#api-pending')).toHaveCount(0);
  await page.locator('#to-today').click();
  await expect(page.locator('[data-status=tooEarly]')).toBeVisible();
});

for (const [id, status, heading] of [
  ['stable', 'ready', 'Here is what the sensors saw in the last day'],
  ['stale', 'stale', "We haven't heard from the hub since 30 h ago"],
  ['gaps', 'ready', 'Here is what the sensors saw in the last day'],
  ['day0', 'tooEarly', 'Your first insight arrives after the first full day'],
] as const) {
  test(`4 insight: ${id} -> ${status}`, async ({ page }) => {
    await pickScenario(page, id);
    await invite(page);
    await acceptAs(page);
    await open(page, '/#/today');
    await expect(page.locator(`[data-status=${status}]`)).toBeVisible();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    if (id !== 'day0') await expect(page.getByRole('heading', { name: 'How sure is this?' })).toBeVisible();
    await expect(page.getByText('Freshness', { exact: true })).toBeVisible();
    await expect(page.getByText('Coverage', { exact: true })).toBeVisible();
    if (id === 'stale') await expect(page.locator('.reading[data-state=reporting]')).toHaveCount(0);
    if (id === 'gaps') {
      await expect(page.locator('.reading[data-cat=drinks]')).toHaveAttribute('data-state', 'missing');
      await expect(page.getByText(/incomplete/)).toBeVisible();
    }
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/diagnos|dementia|all is well|everything is fine|predict/i);
    await axe(page);
  });
}

for (const [id, state] of [['stable', 'stable'], ['changed', 'changed'], ['gaps', 'insufficient'], ['stale', 'forming']] as const) {
  test(`5 weekly: ${id} -> ${state}`, async ({ page }) => {
    await pickScenario(page, id);
    await invite(page);
    await acceptAs(page);
    await open(page, '/#/week');
    await expect(page.locator(`[data-weekly=${state}]`)).toBeVisible();
    if (state === 'changed') await expect(page.locator('.trend[data-dir=less]')).not.toHaveCount(0);
    if (state === 'insufficient') await expect(page.locator('.trend[data-dir=unknown]')).not.toHaveCount(0);
    await page.check('input[value=daily]');
    await expect(page.locator('input[value=daily]')).toBeChecked();
    await page.getByRole('button', { name: 'Mark as checked in' }).click();
    await expect(page.getByText(/Nothing was actually sent/)).toBeVisible();
    await axe(page);
  });
}

test('6 lab: synthetic labels, copy variant changes start screen, events recorded', async ({ page }) => {
  await invite(page);
  await open(page, '/#/lab');
  await expect(page.getByText('Every number on this page is synthetic.')).toBeVisible();
  const counts = await page.locator('.funnel li').count();
  expect(await page.locator('.funnel .synth').count()).toBeGreaterThanOrEqual(counts);
  await expect(page.locator('table')).toContainText('invite_sent');
  await expect(page.locator('table')).toContainText('"synthetic":true');
  await axe(page);
  await page.check('input[value=setupFirst]');
  await open(page, '/#/start');
  await expect(page.locator('h1')).toContainText('your kit');
});

test('keyboard: complete invite and consent with keyboard only', async ({ page }) => {
  await open(page, '/#/start');
  const submit = page.getByRole('button', { name: /Continue to consent/ });
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toBeFocused();
  await page.locator('#send-invite').focus();
  await page.keyboard.press('Enter');
  await page.locator('#as-monitored').focus();
  await page.keyboard.press('Enter');
  await page.locator('input[value=drinks]').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.locator('input[value=meals]')).toBeChecked();
  await page.getByRole('button', { name: "Share what I've chosen" }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /said yes to 2 of 6/ })).toBeVisible();
});

test('keyboard: skip link and visible focus ring', async ({ page }) => {
  await open(page, '/#/start');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).toBe('solid');
});

test('responsive: no horizontal overflow on any screen', async ({ page }) => {
  await invite(page);
  await acceptAs(page);
  for (const r of ['start', 'consent', 'setup', 'today', 'week', 'lab']) {
    await open(page, `/#/${r}`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, r).toBeLessThanOrEqual(0);
  }
  await page.goto('/brand-guide.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('brand guide page passes axe', async ({ page }) => {
  await page.goto('/brand-guide.html');
  await axe(page);
});

const lab = (page: Page) => page.evaluate(() => (window as unknown as { __lab: () => any }).__lab());
const ready = (page: Page) => page.waitForSelector('body[data-lab="ok"]');

test('backend: reload keeps the saved synthetic state', async ({ page }) => {
  await invite(page);
  await expect(page.locator('#demo-role-note')).toContainText('Demo role switch, not sign-in');
  await acceptAs(page, ['drinks', 'meals']);
  await pickScenario(page, 'changed');
  await expect.poll(async () => (await lab(page)).scenario).toBe('changed');
  await page.reload();
  await ready(page);
  const s = await lab(page);
  expect(s.consent).toMatchObject({ status: 'accepted', shared: ['drinks', 'meals'] });
  expect(s.scenario).toBe('changed');
  await expect(page.getByTestId('rail-revision')).toContainText(`Server revision ${s.revision}`);
});

test('backend: a second tab revoking consent is not overwritten by a stale first tab', async ({ page, context }) => {
  await invite(page);
  await acceptAs(page);
  const other = await context.newPage();
  await open(other, '/#/consent');
  await other.locator('#as-monitored').click();
  await other.locator('#revoke-all').click();
  await expect(other.getByText('All sharing is off (simulated).')).toBeVisible();
  await page.locator('#as-monitored').click();
  await expect(page.locator('#api-error')).toContainText('changed in another tab');
  expect((await lab(page)).consent.status).toBe('revoked');
  await open(page, '/#/today');
  await expect(page.locator('main')).toContainText('Sharing has been turned off');
});

test('backend: export follows current consent after a category revoke', async ({ page }) => {
  await invite(page);
  await acceptAs(page);
  await page.locator('#as-monitored').click();
  await page.locator('[data-revoke="drinks"]').click();
  await expect.poll(async () => (await lab(page)).consent.shared.length).toBe(5);
  const ex = await (await page.request.get('/api/export')).json();
  expect(ex.synthetic).toBe(true);
  expect(JSON.stringify(ex)).not.toContain('drinks');
});

test('backend: a failed write shows an error and changes nothing', async ({ page }) => {
  await invite(page);
  await page.route('**/api/command', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'storage_unavailable', message: 'Lab storage is unavailable. Nothing was changed.' }) }));
  await page.locator('#as-monitored').click();
  await expect(page.locator('#api-error')).toContainText('Lab storage is unavailable');
  await page.unroute('**/api/command');
  await page.reload();
  await ready(page);
  expect((await lab(page)).consent.status).toBe('pending');
  await expect(page.locator('#as-monitored')).toBeVisible();
});

test('backend: if saved state cannot load, nothing is shown', async ({ page }) => {
  await page.route('**/api/state', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'storage_unavailable', message: 'Lab storage is unavailable.' }) }));
  await page.goto('/#/today');
  await page.waitForSelector('body[data-lab="down"]');
  await expect(page.locator('h1')).toContainText('Nothing to');
  await expect(page.locator('main')).not.toContainText('sensors saw');
  await expect(page.getByTestId('rail-revision')).toHaveCount(0);
  await axe(page);
  await page.unroute('**/api/state');
  await page.locator('#retry-load').click();
  await ready(page);
  await expect(page.locator('h1')).not.toContainText('Nothing to');
});

/* ---------- pending commands at real network latency ---------- */

async function toSetup(page: Page) {
  await pickScenario(page, 'day0');
  await invite(page);
  await acceptAs(page);
  await page.locator('#to-setup').click();
  await expect(page.getByRole('heading', { name: '5 of 7 needed sensors reporting' })).toBeVisible();
}
/** Holds every /api/command until release() is called, and records the command types the page sent. */
async function holdCommands(page: Page, answer?: () => { status: number; body: unknown }) {
  const sent: string[] = [];
  let open!: () => void;
  let gate = new Promise<void>((r) => { open = r; });
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/command')) sent.push(r.postDataJSON().type); });
  await page.route('**/api/command', async (r) => {
    await gate;
    const a = answer?.();
    if (a) await r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
    else await r.fallback();
  });
  return {
    sent,
    release() { open(); gate = new Promise<void>((r) => { open = r; }); },
  };
}

test('latency: the audit click sequence completes with 800 ms per command', async ({ page }) => {
  await toSetup(page);
  await page.route('**/api/command', async (r) => { await new Promise((res) => setTimeout(res, 800)); await r.fallback(); });
  await page.getByRole('button', { name: 'Pair (simulated)' }).click();
  await page.getByRole('button', { name: 'Send test event (simulated)' }).first().click();
  await page.getByRole('button', { name: 'Send test event (simulated)' }).first().click();
  await expect(page.getByRole('heading', { name: '7 of 7 needed sensors reporting' })).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.getByRole('heading', { name: '7 of 7 needed sensors reporting' })).toBeVisible();
});

test('latency: clicks on paused controls are dropped, not sent against stale state', async ({ page }) => {
  await toSetup(page);
  const hold = await holdCommands(page);
  const stale = page.getByRole('button', { name: 'Send test event (simulated)' }).first();
  const staleSensor = await stale.getAttribute('data-test');
  await page.getByRole('button', { name: 'Pair (simulated)' }).click();
  await expect(page.locator('#api-pending')).toContainText('Pairing the sensor (simulated)');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
  await expect(stale).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#to-today')).toHaveAttribute('aria-disabled', 'true');
  await axe(page);
  const box = (await stale.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await stale.click({ force: true });
  await stale.focus();
  await page.keyboard.press('Enter');
  expect(hold.sent).toEqual(['pairSensor']);
  hold.release();
  await expect(page.locator('#api-pending')).toHaveCount(0);
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
  expect(hold.sent).toEqual(['pairSensor']);
  await expect(page.locator(`[data-sensor="${staleSensor}"]`)).toHaveAttribute('data-sensor-status', 'waiting');
  await expect(page.getByRole('heading', { name: '5 of 7 needed sensors reporting' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send test event (simulated)' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Send test event (simulated)' }).first()).not.toHaveAttribute('aria-disabled', 'true');
});

test('latency: a slow failed command shows the error, unpauses, and changes nothing', async ({ page }) => {
  await toSetup(page);
  const hold = await holdCommands(page, () => ({ status: 503, body: { error: 'storage_unavailable', message: 'Lab storage is unavailable. Nothing was changed.' } }));
  const pair = page.getByRole('button', { name: 'Pair (simulated)' });
  const sensor = await pair.getAttribute('data-pair');
  await pair.click();
  await expect(page.locator('#api-pending')).toBeVisible();
  hold.release();
  await expect(page.locator('#api-error')).toContainText('Lab storage is unavailable');
  await expect(page.locator('#api-pending')).toHaveCount(0);
  await expect(page.locator(`[data-sensor="${sensor}"]`)).toHaveAttribute('data-sensor-status', 'notPaired');
  await expect(pair).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('heading', { name: '5 of 7 needed sensors reporting' })).toBeVisible();
  await axe(page);
  await page.unroute('**/api/command');
  await page.reload();
  await ready(page);
  await expect(page.locator(`[data-sensor="${sensor}"]`)).toHaveAttribute('data-sensor-status', 'notPaired');
  expect(hold.sent).toEqual(['pairSensor']);
});

test('latency: keyboard user keeps focus while pending and lands on the next step', async ({ page }) => {
  await toSetup(page);
  const hold = await holdCommands(page);
  const pair = page.getByRole('button', { name: 'Pair (simulated)' });
  const sensor = await pair.getAttribute('data-pair');
  await pair.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#api-pending')).toBeVisible();
  await expect(pair).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  hold.release();
  await expect(page.locator(`[data-sensor="${sensor}"]`)).toHaveAttribute('data-sensor-status', 'waiting');
  await expect(page.locator(`[data-test="${sensor}"]`)).toBeFocused();
  expect(hold.sent).toEqual(['pairSensor']);
  await page.keyboard.press('Enter');
  await expect(page.locator('#api-pending')).toContainText('Sending the test event');
  hold.release();
  await expect(page.locator(`[data-sensor="${sensor}"]`)).toHaveAttribute('data-sensor-status', 'ready');
  expect(hold.sent).toEqual(['pairSensor', 'testSensor']);
});
