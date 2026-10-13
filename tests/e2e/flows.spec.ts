import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ALL = ['drinks', 'meals', 'outside', 'wake', 'night', 'bathroom'];

async function invite(page: Page) {
  await page.goto('/#/start');
  await page.getByRole('button', { name: /Continue to consent/ }).click();
  await page.locator('#send-invite').click();
}
async function acceptAs(page: Page, cats = ALL) {
  await page.locator('#as-monitored').click();
  for (const c of cats) await page.check(`input[value=${c}]`);
  await page.getByRole('button', { name: "Share what I've chosen" }).click();
}
async function pickScenario(page: Page, id: string) {
  await page.goto('/#/lab');
  await page.selectOption('#scenario-lab', id);
}
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
}

test('1 start: fictional household, relationship, goal, simulated-data explainer', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/#/today');
  await expect(page.getByRole('heading', { name: 'Waiting for consent' })).toBeVisible();
  await expect(page.locator('.reading')).toHaveCount(0);
  await page.goto('/#/week');
  await expect(page.locator('[data-weekly=locked]')).toBeVisible();
  await page.goto('/#/setup');
  await expect(page.getByText(/Paused until Grace says yes/)).toBeVisible();
  await expect(page.locator('#to-today')).toBeDisabled();
  await page.goto('/#/consent');
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
  await page.goto('/#/today');
  await expect(page.locator('.reading[data-state=notShared]')).toHaveCount(4);
});

test('2 consent: decline shares nothing; ask again returns to pending', async ({ page }) => {
  await invite(page);
  await page.locator('#as-monitored').click();
  await page.locator('#decline').click();
  await expect(page.getByRole('heading', { name: 'Grace said no' })).toBeVisible();
  await page.goto('/#/today');
  await expect(page.getByRole('heading', { name: 'Waiting for consent' })).toBeVisible();
  await page.goto('/#/consent');
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
  await page.goto('/#/today');
  await expect(page.locator('.reading[data-cat=bathroom]')).toHaveAttribute('data-state', 'notShared');
  await page.goto('/#/consent');
  await page.locator('#as-monitored').click();
  await page.locator('#revoke-all').click();
  await expect(page.getByRole('heading', { name: 'Grace turned sharing off' })).toBeVisible();
  await page.goto('/#/today');
  await expect(page.getByRole('heading', { name: 'Sharing has been turned off' })).toBeVisible();
  await expect(page.locator('.reading')).toHaveCount(0);
  await page.goto('/#/week');
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
  await page.getByRole('button', { name: 'Pair (simulated)' }).click();
  await page.getByRole('button', { name: 'Send test event (simulated)' }).first().click();
  await page.getByRole('button', { name: 'Send test event (simulated)' }).first().click();
  await expect(page.getByRole('heading', { name: '7 of 7 needed sensors reporting' })).toBeVisible();
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
    await page.goto('/#/today');
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
    await page.goto('/#/week');
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
  await page.goto('/#/lab');
  await expect(page.getByText('Every number on this page is synthetic.')).toBeVisible();
  const counts = await page.locator('.funnel li').count();
  expect(await page.locator('.funnel .synth').count()).toBeGreaterThanOrEqual(counts);
  await expect(page.locator('table')).toContainText('invite_sent');
  await expect(page.locator('table')).toContainText('"synthetic":true');
  await axe(page);
  await page.check('input[value=setupFirst]');
  await page.goto('/#/start');
  await expect(page.locator('h1')).toContainText('your kit');
});

test('keyboard: complete invite and consent with keyboard only', async ({ page }) => {
  await page.goto('/#/start');
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
  await page.goto('/#/start');
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
    await page.goto(`/#/${r}`);
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
