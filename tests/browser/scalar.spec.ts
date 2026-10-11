import { expect, test } from '@playwright/test';
async function start(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page
    .getByLabel('Probability model', { exact: true })
    .selectOption('scalar');
  await expect(
    page.getByRole('heading', { name: 'Coupled Gaussian pair', exact: true }),
  ).toBeVisible();
}
async function openParameters(page: import('@playwright/test').Page) {
  if (!(await page.getByLabel('Scalar preset', { exact: true }).isVisible()))
    await page
      .getByText('Geometry & scalar parameters', { exact: true })
      .click();
}
test('coupled Gaussian graph, exact reference, direct vector draw and conditional distinction', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await expect(
    page.getByText('Analytic exact multivariate Gaussian', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('scalar-configuration')).toContainText(
    'Configuration: [',
  );
  await expect(page.getByTestId('scalar-transition-details')).toContainText(
    'whole-vector independent Gaussian draw',
  );
  await page.getByRole('button', { name: /Select variable v1,/ }).click();
  await expect(page.getByLabel('Selected site', { exact: true })).toHaveValue(
    'v1',
  );
  await page.getByTestId('scalar-site-panel').locator('summary').click();
  await expect(page.getByTestId('scalar-site-panel')).toContainText(
    'This is not the equilibrium marginal',
  );
  await page.getByRole('button', { name: /Select bond e0,/ }).click();
  await page.getByTestId('scalar-bond-panel').locator('summary').click();
  await expect(page.getByTestId('scalar-bond-panel')).toContainText(
    'difference xₜ−xₕ',
  );
  await page
    .getByRole('button', { name: 'Edit coupling e0', exact: true })
    .click();
  await expect(page.getByLabel('Coupling e0', { exact: true })).toBeFocused();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('double wells, quartic reference, local Metropolis and segment isolation', async ({
  page,
}) => {
  await start(page);
  await openParameters(page);
  await page
    .getByLabel('Scalar preset', { exact: true })
    .selectOption('double-well');
  await expect(
    page.getByRole('heading', { name: 'Single site', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Numerical quadrature reference', { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('scalar-transition-details')).toContainText(
    'random-site Metropolis',
  );
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await openParameters(page);
  await page.getByLabel('Source h v0').fill('0.5');
  await page
    .getByRole('button', { name: 'Apply scalar parameters', exact: true })
    .click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  const plotTwo = page.getByRole('button', { name: 'Plot 2', exact: true });
  if (await plotTwo.isVisible()) await plotTwo.click();
  await page.getByLabel('View for plot 2').selectOption('bare');
  await expect(
    page.getByRole('img', { name: 'Bare local potential' }),
  ).toBeVisible();
  await page.getByLabel('View for plot 2').selectOption('conditional-density');
  await expect(
    page
      .getByRole('region', { name: 'Real scalar plots' })
      .getByText('This is not the equilibrium marginal.', { exact: false })
      .last(),
  ).toBeVisible();
  const before = await page.getByTestId('scalar-configuration').textContent();
  await page.getByRole('button', { name: 'Fit All', exact: true }).click();
  await expect(page.getByTestId('scalar-configuration')).toHaveText(before!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('torus retains eight gradient bonds and display edits preserve seeded updates', async ({
  page,
}) => {
  await start(page);
  await openParameters(page);
  await page
    .getByLabel('Scalar geometry', { exact: true })
    .selectOption('torus');
  await expect(page.getByText('4 sites · 8 bonds · 4 faces')).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const first = await page
    .getByTestId('scalar-transition-details')
    .textContent();
  await page.getByLabel('Selected bond', { exact: true }).selectOption('e6');
  await page.getByRole('button', { name: 'Add Plot', exact: true }).click();
  await page.getByLabel('View for plot 3').selectOption('covariance');
  await page.getByRole('button', { name: 'Fit All', exact: true }).click();
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('scalar-transition-details')).toHaveText(
    first!,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('versioned URL reload restores scalar parameters and sampler without measurement history', async ({
  page,
}) => {
  await start(page);
  await openParameters(page);
  await page.getByLabel('Coupling e0', { exact: true }).fill('1.3');
  await page
    .getByRole('button', { name: 'Apply scalar parameters', exact: true })
    .click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByText('Share scalar configuration', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Copy configuration link', exact: true })
    .click();
  const link = await page
    .getByLabel('Configuration link', { exact: true })
    .inputValue();
  expect(link).toContain('config=');
  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'Coupled Gaussian pair', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await openParameters(page);
  await expect(page.getByLabel('Coupling e0', { exact: true })).toHaveValue(
    '1.3',
  );
  const url = new URL(link);
  const payload = JSON.parse(url.searchParams.get('config')!);
  payload.version = 99;
  url.searchParams.set('config', JSON.stringify(payload));
  await page.goto(url.toString());
  await expect(page.getByRole('alert')).toContainText(
    'Unsupported scalar configuration schema version',
  );
});
test('four coupled quartic sites expose sampled marginals, conditionals and phone overview', async ({
  page,
}) => {
  await start(page);
  await openParameters(page);
  await page
    .getByLabel('Scalar preset', { exact: true })
    .selectOption('four-quartic');
  await expect(
    page.getByRole('heading', { name: 'Open 2×2 square', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Sampled only', { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByTestId('scalar-site-panel').locator('summary').click();
  await expect(page.getByTestId('scalar-site-panel')).toContainText(
    'This is not the equilibrium marginal',
  );
  const overview = page.getByRole('button', {
    name: 'Compact overview',
    exact: true,
  });
  if (await overview.isVisible()) await overview.click();
  await page.getByLabel('Variable for plot 1').selectOption('v0·v1');
  await page.getByLabel('View for plot 2').selectOption('covariance');
  await expect(
    page.getByText('no exact coupled-quartic reference', { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('running means keep separately labeled parameter-segment histories', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const plotTwo = page.getByRole('button', { name: 'Plot 2', exact: true });
  if (await plotTwo.isVisible()) await plotTwo.click();
  await page.getByLabel('View for plot 2').selectOption('mean');
  await openParameters(page);
  await page.getByLabel('Source h v0').fill('0.8');
  await page
    .getByRole('button', { name: 'Apply scalar parameters', exact: true })
    .click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const running = page.getByRole('img', { name: 'Running mean' });
  await expect(running).toBeVisible();
  await expect(running.locator('[aria-label="Segment 1"]')).toHaveCount(1);
  await expect(running.locator('[aria-label="Segment 2"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fit All', exact: true }).click();
  await expect(page.getByTestId('total-updates')).toHaveText('2');
});
