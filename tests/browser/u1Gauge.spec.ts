import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
test.describe.configure({ timeout: 90000 });
const choose = (p: Page) => p.getByLabel('Named example', { exact: true });
const workspace = (p: Page) => p.locator('.u1-workspace');
const step = (p: Page) => p.getByRole('button', { name: 'Step', exact: true });
const updates = (p: Page) => p.getByTestId('u1-updates');
const featured = (p: Page) => workspace(p).getByTestId('featured-tool');
async function feature(p: Page, id: string) {
  await p.getByLabel('U(1) tools featured tool').selectOption(id);
}
async function settings(p: Page) {
  if (!(await p.getByLabel('U(1) geometry').isVisible()))
    await p.getByText('U(1) settings', { exact: true }).click();
}
async function open(p: Page, geometry = 'torus') {
  await p.goto('./#small-systems');
  await expect(choose(p)).toBeEnabled();
  await choose(p).selectOption(`u1-${geometry}`);
  await expect(step(p)).toBeEnabled();
  await settings(p);
}
async function apply(p: Page) {
  await p
    .getByRole('button', { name: 'Apply U(1) settings', exact: true })
    .click();
  await expect(step(p)).toBeEnabled();
}
async function takeStep(p: Page, n: number) {
  await step(p).click();
  await expect(updates(p)).toHaveText(String(n));
}
async function noOverflow(p: Page) {
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
}

test('U(1) catalog, periodic links, independent worker lifecycle and signed segments', async ({
  page,
}, info) => {
  const errors: string[] = [],
    failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => failed.push(r.url()));
  await open(page);
  await expect(choose(page).locator('option')).toHaveCount(24);
  await expect(
    page.getByRole('navigation', { name: 'Workspaces' }).getByRole('link'),
  ).toHaveCount(5);
  await expect(
    workspace(page).getByLabel('Selected link').locator('option'),
  ).toHaveCount(8);
  await expect(
    workspace(page).getByLabel('Selected face').locator('option'),
  ).toHaveCount(4);
  await workspace(page)
    .getByRole('button', { name: 'Select link e6 wrap', exact: true })
    .click();
  await expect(workspace(page).getByLabel('Selected link')).toHaveValue('e6');
  await takeStep(page, 1);
  await expect(page.getByTestId('u1-samples')).toHaveText('0');
  await page.getByLabel('Angular proposal half-width (radians)').fill('4');
  await page
    .getByRole('button', { name: 'Apply U(1) settings', exact: true })
    .click();
  expect(
    await page
      .getByLabel('Angular proposal half-width (radians)')
      .evaluate((e: HTMLInputElement) => e.validity.rangeOverflow),
  ).toBe(true);
  await expect(page.getByTestId('u1-applied')).toContainText('width=0.8');
  await page.getByLabel('Angular proposal half-width (radians)').fill('0.8');
  await page.getByLabel('Dimensionless U(1) coupling K').fill('-0.7');
  await page.getByLabel('U(1) warm-up sweeps').fill('0');
  await expect(page.getByTestId('u1-applied')).toContainText('K=0.7');
  await apply(page);
  await expect(page.getByTestId('u1-segment')).toHaveText('2');
  await expect(updates(page)).toHaveText('1');
  const start = Date.now();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () => Number(await updates(page).textContent()))
    .toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  console.info(
    `M5b ${info.project.name} torus run/render/acknowledged-pause ${Date.now() - start}ms`,
  );
  await noOverflow(page);
  if (info.project.name !== 'desktop')
    await page.getByText('U(1) settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5b-${info.project.name}.png`,
    fullPage: true,
  });
  await settings(page);
  await page.getByLabel('U(1) geometry').selectOption('square');
  await apply(page);
  await expect(updates(page)).toHaveText('0');
  await expect(workspace(page).getByLabel('Selected link')).toHaveValue('e0');
  await expect(
    workspace(page).getByLabel('Selected link').locator('option'),
  ).toHaveCount(4);
  for (const id of ['gauge-square', 'gauge-torus']) {
    await choose(page).selectOption(id);
    await expect(step(page)).toBeEnabled();
    await step(page).click();
    await expect(page.getByTestId('gauge-updates')).toHaveText('1');
  }
  await choose(page).selectOption('scalar');
  await expect(page.getByTestId('example-description')).toContainText(
    'Coupled Gaussian pair',
  );
  await choose(page).selectOption('u1-torus');
  await expect(updates(page)).toHaveText('0');
  await expect(step(page)).toBeEnabled();
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await noOverflow(page);
});

test('U(1) complex gauge preview, orientation, invariants and display-only replay', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('U(1) warm-up sweeps').fill('0');
  await page.getByLabel('U(1) measurement stride (sweeps)').fill('1');
  await apply(page);
  for (let n = 1; n <= 8; n++) await takeStep(page, n);
  await feature(page, 'inspection');
  const before = await featured(page)
    .getByTestId('u1-invariants')
    .textContent();
  const phases = await featured(page)
    .getByRole('table', { name: 'Current complex plaquettes' })
    .textContent();
  await feature(page, 'transform');
  await featured(page)
    .getByLabel('U(1) transformation vertex')
    .selectOption('v2');
  await featured(page).getByLabel('Vertex phase α (radians)').fill('1.2');
  await featured(page)
    .getByRole('button', { name: 'Preview U(1) transformation', exact: true })
    .click();
  await expect(featured(page).getByTestId('u1-preview')).toContainText(
    'Before θ',
  );
  await expect(updates(page)).toHaveText('8');
  await featured(page)
    .getByRole('button', {
      name: 'Apply U(1) vertex transformation',
      exact: true,
    })
    .click();
  await expect(step(page)).toBeEnabled();
  await expect(updates(page)).toHaveText('8');
  await expect(page.getByTestId('u1-samples')).toHaveText('1');
  await expect(page.getByTestId('u1-segment')).toHaveText('2');
  await feature(page, 'inspection');
  await expect(featured(page).getByTestId('u1-invariants')).toHaveText(before!);
  await expect(
    featured(page).getByRole('table', { name: 'Current complex plaquettes' }),
  ).toHaveText(phases!);
  await feature(page, 'loops');
  await page.getByLabel('Inspected U(1) Wilson loop').selectOption('pair');
  await expect(featured(page)).toContainText('+e0 +e2 +e1 −e6 −e4 −e1');
  await page.getByLabel('Inspected U(1) Wilson loop').selectOption('wy');
  await expect(featured(page)).toContainText('+e1 +e5');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(updates(page)).toHaveText('0');
  await feature(page, 'transform');
  await featured(page)
    .getByLabel('U(1) transformation vertex')
    .selectOption('v0');
  await featured(page)
    .getByLabel('Vertex phase α (radians)')
    .fill(String(Math.PI));
  await featured(page)
    .getByRole('button', { name: 'Preview U(1) transformation', exact: true })
    .click();
  await featured(page)
    .getByRole('button', {
      name: 'Apply U(1) vertex transformation',
      exact: true,
    })
    .click();
  await expect(step(page)).toBeEnabled();
  await feature(page, 'graph');
  await expect(featured(page).getByTestId('u1-link')).toContainText(
    'θ=-3.1416',
  );
  await expect(updates(page)).toHaveText('0');
  // Reset separates exact seeded replay from the roundoff-equivalent gauge test.
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(updates(page)).toHaveText('0');
  await takeStep(page, 1);
  await feature(page, 'transition');
  const trace = await featured(page).getByTestId('u1-transition').textContent();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(updates(page)).toHaveText('0');
  for (const id of ['reference', 'distribution', 'history', 'winding', 'graph'])
    await feature(page, id);
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Add tool', exact: true }),
  ).toBeDisabled();
  await expect(updates(page)).toHaveText('0');
  await takeStep(page, 1);
  await feature(page, 'transition');
  await expect(featured(page).getByTestId('u1-transition')).toHaveText(trace!);
  const overview = workspace(page).getByRole('button', {
    name: 'Compact overview',
    exact: true,
  });
  if (await overview.isVisible()) await overview.click();
  await noOverflow(page);
});

test('U(1) normalized references, signed means, histograms and bounded history', async ({
  page,
}) => {
  await open(page, 'square');
  await feature(page, 'reference');
  await expect(featured(page).getByTestId('u1-reference')).toContainText(
    'resolved',
  );
  await expect(featured(page)).toContainText('0.3302');
  await page.getByLabel('Dimensionless U(1) coupling K').fill('0');
  await page.getByLabel('U(1) warm-up sweeps').fill('0');
  await page.getByLabel('U(1) measurement stride (sweeps)').fill('1');
  await apply(page);
  await expect(featured(page).getByTestId('u1-reference')).toContainText('Z=1');
  await feature(page, 'winding');
  await expect(featured(page)).toContainText('no noncontractible');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('u1-samples').textContent()),
    )
    .toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  const count = await updates(page).textContent();
  await feature(page, 'history');
  await expect(featured(page)).toContainText('256 recent');
  await feature(page, 'distribution');
  await noOverflow(page);
  await expect(
    featured(page).getByRole('img', { name: 'f0 angle probability density' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Experiments', exact: false }).click();
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await expect(updates(page)).toHaveText(count!);
  await page.getByLabel('Dimensionless U(1) coupling K').fill('-0.7');
  await apply(page);
  await feature(page, 'reference');
  await expect(featured(page)).toContainText('-0.3302');
  await page.getByLabel('U(1) geometry').selectOption('torus');
  await page.getByLabel('Dimensionless U(1) coupling K').fill('0.7');
  await apply(page);
  await expect(featured(page).getByTestId('u1-reference')).toContainText(
    'Z=1.6475',
  );
  await expect(featured(page)).toContainText('0.3597');
  await expect(featured(page)).toContainText('0.2137');
  await noOverflow(page);
});
