import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fieldDetail(page: Page, key: number) {
  const selector = page.getByLabel('Lattice Fields tools detail tool');
  if (await selector.isVisible()) await selector.selectOption(String(key));
}

async function addFieldTool(page: Page, tool: string) {
  await page
    .getByLabel('Lattice Fields tools add tool type')
    .selectOption(tool);
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
}

test('1D independent field Step, exact covariance and display-only seeded replay', async ({
  page,
}) => {
  await page.goto('#fields-paths');
  await expect(
    page.getByRole('heading', { name: 'Field profile' }),
  ).toBeVisible();
  await fieldDetail(page, 1);
  await expect(page.getByText('Exact finite volume')).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await fieldDetail(page, 1);
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  const first = await page
    .getByText('Current φ', { exact: false })
    .first()
    .textContent();
  await page.getByLabel('Inspect field site').fill('3');
  await page.getByLabel('Field display limit').fill('2');
  await page.getByLabel('Inspect field site').fill('0');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('0');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  expect(
    await page.getByText('Current φ', { exact: false }).first().textContent(),
  ).toBe(first);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('2D heatmap, local conditional and Metropolis segments work on phone and desktop', async ({
  page,
}) => {
  await page.goto('#fields-paths');
  await page.getByLabel('Field dimension').selectOption('rectangle');
  await page.getByLabel('Field width').fill('2');
  await page.getByLabel('Field height').fill('2');
  await page.getByLabel('Field mass coefficient r').fill('0.07');
  await page.getByLabel('Horizontal stiffness').fill('0.15');
  await page.getByLabel('Field source').fill('0.05');
  await page.getByLabel('Field update method').selectOption('heat-bath');
  await page.getByLabel('Field thermalization sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(
    page.getByRole('heading', { name: 'Field heatmap' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Select site x 0, y 0/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await addFieldTool(page, 'update');
  await expect(page.getByText('Coordinate heat bath resamples')).toBeVisible();
  await expect(page.getByTestId('field-updates')).toHaveText('1');
  await page.getByLabel('Field update method').selectOption('metropolis');
  await page.getByLabel('Field proposal width').fill('0.015');
  await page.getByLabel('Field thermalization sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByText(/Segment 2:/)).toBeVisible();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('field-samples').textContent()),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await fieldDetail(page, 1);
  await expect(page.getByText('Connected covariance')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('parameter Apply isolates measurements while retaining comparison records', async ({
  page,
}) => {
  await page.goto('#fields-paths');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  await page.getByLabel('Field source').fill('1');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByText(/Segment 2:/)).toBeVisible();
  await expect(page.getByTestId('field-samples')).toHaveText('0');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  await addFieldTool(page, 'history');
  await expect(page.getByText(/segment 1: 1 measurements/)).toBeVisible();
  await expect(page.getByText(/segment 2: 1 measurements/)).toBeVisible();
});

test('periodic spectral fields and constrained support reset are usable on desktop and phone', async ({
  page,
}) => {
  await page.goto('#fields-paths');
  await page
    .getByRole('button', { name: 'Draft massive periodic example' })
    .click();
  await expect(page.getByLabel('Field mass coefficient r')).toHaveValue('1');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await addFieldTool(page, 'spectrum');
  await expect(
    page.getByRole('heading', { name: 'Finite-volume Fourier spectrum' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  await fieldDetail(page, 1);
  const before = await page
    .getByText('Current φ', { exact: false })
    .first()
    .textContent();
  await fieldDetail(page, 2);
  await page.getByRole('button', { name: /Select momentum kx 1/ }).click();
  await fieldDetail(page, 1);
  await page.getByLabel('Inspect field site').fill('2');
  await page.getByLabel('Inspect field site').fill('0');
  expect(
    await page.getByText('Current φ', { exact: false }).first().textContent(),
  ).toBe(before);
  await page
    .getByRole('button', { name: 'Draft massless mean-zero example' })
    .click();
  await expect(page.getByLabel('Field source')).toBeDisabled();
  await expect(page.getByLabel('Field mass coefficient r')).toHaveValue('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('0');
  await expect(
    page.getByText(/Fixing all other sites determines this site/),
  ).toBeVisible();
  await fieldDetail(page, 2);
  await expect(
    page.getByRole('button', { name: /removed zero mode/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('field-samples').textContent()),
    )
    .toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('2D constrained periodic field exposes momentum grid and accepts numeric mode selection', async ({
  page,
}) => {
  await page.goto('#fields-paths');
  await page.getByLabel('Field dimension').selectOption('rectangle');
  await page.getByLabel('Field width').fill('2');
  await page.getByLabel('Field height').fill('2');
  await page.getByLabel('Field measure').selectOption('mean-zero');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(
    page.getByRole('heading', { name: 'Field heatmap' }),
  ).toBeVisible();
  await addFieldTool(page, 'spectrum');
  await expect(
    page.getByRole('button', {
      name: /Select momentum kx 0, ky 0, removed zero mode/,
    }),
  ).toBeVisible();
  await page.getByLabel('Fourier momentum index').fill('3');
  await expect(page.getByText(/Selected k=\(1,1\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('8×8 mean-zero field with tiny positive stiffness steps without a reality error', async ({
  page,
}) => {
  await page.goto('#fields-paths');
  await page.getByLabel('Field dimension').selectOption('rectangle');
  await page.getByLabel('Field width').fill('8');
  await page.getByLabel('Field height').fill('8');
  await page.getByLabel('Field measure').selectOption('mean-zero');
  await page.getByLabel('Horizontal stiffness').fill('0.000000000001');
  await page.getByLabel('Vertical stiffness').fill('0.000000000001');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('0');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  await expect(
    page.getByText(/Spectral draw violated conjugate reality/),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});
