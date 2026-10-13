import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
test.describe.configure({ timeout: 90000 });
const step = (p: Page) => p.getByRole('button', { name: 'Step', exact: true });
const updates = (p: Page) => p.getByTestId('gauge-updates');
const choose = (p: Page) => p.getByLabel('Named example', { exact: true });
async function open(p: Page, geometry = 'torus') {
  await p.goto('./#small-systems');
  await expect(choose(p)).toBeEnabled();
  await choose(p).selectOption(`gauge-${geometry}`);
  await expect(step(p)).toBeEnabled();
  if (!(await p.getByLabel('Gauge geometry').isVisible()))
    await p.getByText('Gauge settings', { exact: true }).click();
}
async function feature(p: Page, id: string) {
  await p.getByLabel('Gauge tools featured tool').selectOption(id);
}
async function apply(p: Page) {
  await p
    .getByRole('button', { name: 'Apply gauge settings', exact: true })
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

test('tiny gauge catalog, all physical links, selectors and production worker lifecycle', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(
    page.getByRole('navigation', { name: 'Workspaces' }).getByRole('link'),
  ).toHaveCount(5);
  await expect(page.getByLabel('Selected link')).toHaveValue('e0');
  await expect(page.getByLabel('Selected link').locator('option')).toHaveCount(
    8,
  );
  await page
    .getByRole('button', { name: 'Select link e6 wrap', exact: true })
    .click();
  await expect(page.getByLabel('Selected link')).toHaveValue('e6');
  await page.getByLabel('Selected vertex').selectOption('v3');
  await page.getByLabel('Selected face').selectOption('f2');
  await expect(updates(page)).toHaveText('0');
  await takeStep(page, 1);
  await expect(page.getByTestId('gauge-samples')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(updates(page)).toHaveText('0');
  await expect(page.getByTestId('gauge-samples')).toHaveText('0');
  await page.getByLabel('Gauge sampler').selectOption('metropolis');
  await page
    .getByRole('spinbutton', { name: 'Warm-up sweeps', exact: true })
    .fill('0');
  await apply(page);
  await expect(page.getByTestId('gauge-segment')).toHaveText('2');
  await feature(page, 'transition');
  await takeStep(page, 1);
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool'),
  ).toContainText('Actual ΔS');
  await page.getByLabel('Dimensionless coupling K').fill('-0.7');
  await expect(page.getByTestId('gauge-applied')).toContainText('K=0.7');
  await apply(page);
  await expect(page.getByTestId('gauge-segment')).toHaveText('3');
  await expect(updates(page)).toHaveText('1');
  const start = Date.now();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () => Number(await updates(page).textContent()))
    .toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  console.info(
    `M5a ${info.project.name} torus batch/render/pause ${Date.now() - start}ms`,
  );
  await feature(page, 'graph');
  await noOverflow(page);
  if (info.project.name !== 'desktop')
    await page.getByText('Gauge settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5a-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name !== 'desktop')
    await page.getByText('Gauge settings', { exact: true }).click();
  await page.getByLabel('Gauge geometry').selectOption('square');
  await apply(page);
  await expect(updates(page)).toHaveText('0');
  await expect(page.getByLabel('Selected link').locator('option')).toHaveCount(
    4,
  );
  await expect(page.getByLabel('Selected face').locator('option')).toHaveCount(
    1,
  );
  await choose(page).selectOption('scalar');
  await expect(page.getByTestId('example-description')).toContainText(
    'Coupled Gaussian pair',
  );
  await expect(step(page)).toBeEnabled();
  await choose(page).selectOption('gauge-torus');
  await expect(page.getByLabel('Selected link').locator('option')).toHaveCount(
    8,
  );
  expect(errors).toEqual([]);
  await noOverflow(page);
});

test('gauge transformation and ToolDeck assignments are numerically inert', async ({
  page,
}) => {
  await open(page);
  await takeStep(page, 1);
  await feature(page, 'inspection');
  const invariants = await page
    .getByRole('region', { name: 'Gauge tools', exact: true })
    .getByTestId('featured-tool')
    .getByTestId('gauge-invariants')
    .textContent();
  await feature(page, 'transform');
  await page.getByLabel('Gauge transformation vertex').selectOption('v0');
  await page
    .getByRole('button', { name: 'Preview gauge transformation' })
    .click();
  await expect(updates(page)).toHaveText('1');
  await expect(page.getByTestId('gauge-preview')).toContainText('unchanged');
  await page
    .getByRole('button', { name: 'Apply vertex transformation' })
    .click();
  await expect(step(page)).toBeEnabled();
  await expect(updates(page)).toHaveText('1');
  await expect(page.getByTestId('gauge-samples')).toHaveText('1');
  await expect(page.getByTestId('gauge-segment')).toHaveText('1');
  await feature(page, 'inspection');
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool')
      .getByTestId('gauge-invariants'),
  ).toHaveText(invariants!);
  await feature(page, 'transition');
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool'),
  ).toContainText('gauge-transform');
  await feature(page, 'loops');
  await page.getByLabel('Inspected Wilson loop').selectOption('wx');
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool'),
  ).toContainText('+e0 +e2');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Add tool', exact: true }),
  ).toBeDisabled();
  await expect(updates(page)).toHaveText('1');
  await takeStep(page, 2);
  await feature(page, 'transition');
  const after = await page
    .getByRole('region', { name: 'Gauge tools', exact: true })
    .getByTestId('featured-tool')
    .getByTestId('gauge-transition')
    .textContent();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(updates(page)).toHaveText('0');
  await takeStep(page, 1);
  await takeStep(page, 2);
  // Independent sampling overwrites the transformed links; same RNG = same draw.
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool')
      .getByTestId('gauge-transition'),
  ).toHaveText(after!);
  const mode = page.getByRole('button', { name: /overview/i });
  if (await mode.count()) await mode.first().click();
  await noOverflow(page);
});

test('open-square reference and winding guidance, local cadence and keyboard selection', async ({
  page,
}) => {
  await open(page, 'square');
  await feature(page, 'exact');
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool'),
  ).toContainText('16 unfixed link states');
  await feature(page, 'winding');
  await expect(
    page
      .getByRole('region', { name: 'Gauge tools', exact: true })
      .getByTestId('featured-tool'),
  ).toContainText('no noncontractible');
  await feature(page, 'graph');
  await page.getByLabel('Selected link').focus();
  await page.getByLabel('Selected link').selectOption('e3');
  await expect(updates(page)).toHaveText('0');
  await page.getByLabel('Gauge sampler').selectOption('metropolis');
  await page
    .getByRole('spinbutton', { name: 'Warm-up sweeps', exact: true })
    .fill('0');
  await page
    .getByRole('spinbutton', {
      name: 'Measurement stride (sweeps)',
      exact: true,
    })
    .fill('1');
  await apply(page);
  for (let n = 1; n <= 4; n++) await takeStep(page, n);
  await expect(page.getByTestId('gauge-samples')).toHaveText('1');
  await page.getByRole('link', { name: 'Experiments', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'Keep the data. Keep the context.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await expect(updates(page)).toHaveText('4');
  await noOverflow(page);
});
