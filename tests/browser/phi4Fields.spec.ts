import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function open(page: Page) {
  await page.goto('#fields-paths');
  await page.getByLabel('Field model', { exact: true }).selectOption('phi4');
  await expect(page.getByTestId('phi4-updates')).toHaveText('0');
}
async function detail(page: Page, key: number) {
  const selector = page.getByLabel('Spatial φ⁴ tools detail tool');
  if (await selector.isVisible()) await selector.selectOption(String(key));
}
async function add(page: Page, tool: string) {
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  const cards = page
    .getByRole('region', { name: 'Spatial φ⁴ tools', exact: true })
    .getByTestId('teaching-tool');
  await cards
    .last()
    .getByLabel(`Tool ${await cards.count()} type`)
    .selectOption(tool);
  await detail(
    page,
    Number(await cards.last().getAttribute('data-assignment-key')),
  );
}
async function apply(page: Page) {
  await page
    .getByRole('button', { name: 'Apply spatial settings', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
}
async function step(page: Page, updates: number) {
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('phi4-updates')).toHaveText(String(updates));
}
async function runPause(page: Page) {
  const before = Number(await page.getByTestId('phi4-updates').textContent());
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('phi4-updates').textContent()),
    )
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
}

test('spatial φ⁴ draft, validation, sessions, periodic tiny geometries and phone layout', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.getByLabel('Spatial r', { exact: true }).fill('-2');
  await expect(page.getByTestId('phi4-applied')).toContainText('r=-1');
  await apply(page);
  await expect(page.getByTestId('phi4-applied')).toContainText('r=-2');
  await page.getByLabel('Spatial λ', { exact: true }).fill('0');
  await apply(page);
  await expect(page.getByRole('alert')).toContainText('requires r');
  await page.getByLabel('Spatial λ', { exact: true }).fill('0.5');
  await page.getByLabel('Spatial sites N').fill('2');
  await page.getByLabel('Spatial warm-up sweeps').fill('0');
  await apply(page);
  await expect(
    page.getByText('2 sites · 2 bonds', { exact: true }),
  ).toBeVisible();
  await step(page, 1);
  await step(page, 2);
  await expect(page.getByTestId('phi4-samples')).toHaveText('1');
  await page.getByLabel('Spatial source j').fill('0.2');
  await apply(page);
  await expect(page.getByTestId('phi4-segment')).toHaveText('2');
  await expect(page.getByTestId('phi4-updates')).toHaveText('2');
  await expect(page.getByTestId('phi4-samples')).toHaveText('0');
  await page.getByLabel('Spatial geometry').selectOption('rectangle');
  await page.getByLabel('Spatial Lx').fill('2');
  await page.getByLabel('Spatial Ly').fill('2');
  await apply(page);
  await expect(
    page.getByText('4 sites · 8 bonds', { exact: true }),
  ).toBeVisible();
  await runPause(page);
  await page.getByRole('button', { name: /Select site x 1, y 1/ }).click();
  await detail(page, 2);
  await expect(
    page.getByRole('heading', { name: 'Selected spatial site 3', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/This conditional is quartic/)).toBeVisible();
  await detail(page, 1);
  await expect(
    page.getByRole('region', {
      name: 'Sampled spatial correlations',
      exact: true,
    }),
  ).toContainText('Segment 1 y: raw');
  await add(page, 'reference');
  await expect(
    page.getByRole('heading', { name: 'Independent reference unavailable' }),
  ).toBeVisible();
  await page.getByText('Edit spatial φ⁴ settings', { exact: true }).click();
  await detail(page, 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  if (info.project.name === 'desktop' || info.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/m4d1-${info.project.name}.png`,
      fullPage: true,
    });
  await page
    .getByLabel('Field model', { exact: true })
    .selectOption('gaussian');
  await expect(page.getByTestId('field-updates')).toHaveText('0');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-updates')).toHaveText('1');
  await page.getByLabel('Field model', { exact: true }).selectOption('phi4');
  await expect(page.getByTestId('phi4-updates')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('spatial display and lazy reference preserve seeded fields, six-card tools and Reset replay', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Spatial warm-up sweeps').fill('0');
  await apply(page);
  for (let i = 1; i <= 16; i++) await step(page, i);
  const deck = page.getByRole('region', {
    name: 'Spatial φ⁴ tools',
    exact: true,
  });
  const profile = deck.getByTestId('featured-tool').locator('polyline');
  const before = await profile.getAttribute('points');
  await add(page, 'reference');
  await expect(page.getByTestId('phi4-transfer-status')).toContainText(
    'resolved',
    { timeout: 20000 },
  );
  await add(page, 'history');
  await add(page, 'moments');
  await add(page, 'transition');
  await expect(deck.getByTestId('teaching-tool')).toHaveCount(6);
  await expect(
    page.getByRole('button', { name: 'Add tool', exact: true }),
  ).toBeDisabled();
  await deck
    .getByTestId('featured-tool')
    .getByLabel('Spatial field range')
    .fill('4');
  await deck
    .getByTestId('featured-tool')
    .getByLabel('Spatial field range')
    .fill('3');
  await detail(page, 2);
  await deck
    .getByTestId('teaching-tool')
    .nth(1)
    .getByRole('button', { name: /: Feature$/ })
    .click();
  await deck.getByLabel('Spatial φ⁴ tools featured tool').selectOption('field');
  await expect(page.getByTestId('phi4-updates')).toHaveText('16');
  await expect(profile).toHaveAttribute('points', before!);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('phi4-updates')).toHaveText('0');
  for (let i = 1; i <= 16; i++) await step(page, i);
  await expect(profile).toHaveAttribute('points', before!);
  await runPause(page);
});

test('spatial reference statuses distinguish Gaussian, independent, unavailable and unresolved', async ({
  page,
}) => {
  await open(page);
  await add(page, 'reference');
  await expect(page.getByTestId('phi4-transfer-status')).toContainText(
    'resolved',
    { timeout: 20000 },
  );
  // Maps to the existing deep double well rQM=-4, lambdaQM=.05.
  await page.getByLabel('Spatial r', { exact: true }).fill('-2');
  await page.getByLabel('Spatial λ', { exact: true }).fill('0.025');
  await apply(page);
  await step(page, 1);
  await expect(page.getByTestId('phi4-transfer-status')).toContainText(
    'under-resolved',
    { timeout: 20000 },
  );
  await expect(page.getByText(/Trusted bulk length unavailable/)).toBeVisible();
  await page
    .getByLabel('Spatial boundary', { exact: true })
    .selectOption('false');
  await apply(page);
  await expect(
    page.getByRole('heading', { name: 'Independent reference unavailable' }),
  ).toBeVisible();
  await page.getByLabel('Spatial teaching preset').selectOption('4');
  await apply(page);
  await expect(
    page.getByRole('heading', {
      name: 'Independent-site numerical quadrature',
    }),
  ).toBeVisible();
  await page.getByLabel('Spatial teaching preset').selectOption('5');
  await apply(page);
  await expect(
    page.getByRole('heading', {
      name: 'Analytic finite-volume Gaussian limit',
    }),
  ).toBeVisible();
});

test('64-site spatial chains and rectangles remain responsive for single and double wells', async ({
  page,
}, info) => {
  await open(page);
  for (const geometry of ['chain', 'rectangle'])
    for (const r of ['1', '-1']) {
      await page.getByLabel('Spatial geometry').selectOption(geometry);
      if (geometry === 'chain')
        await page.getByLabel('Spatial sites N').fill('64');
      else {
        await page.getByLabel('Spatial Lx').fill('8');
        await page.getByLabel('Spatial Ly').fill('8');
      }
      await page.getByLabel('Spatial r', { exact: true }).fill(r);
      await page.getByLabel('Spatial warm-up sweeps').fill('0');
      await apply(page);
      const start = Date.now();
      await runPause(page);
      const elapsed = Date.now() - start;
      console.log(
        `M4d1 ${info.project.name} ${geometry} r=${r}: ${elapsed} ms Run/Pause round trip`,
      );
      expect(elapsed).toBeLessThan(15000);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      ).toBe(true);
    }
});
