import { expect, test } from '@playwright/test';

test('harmonic oscillator path, segment correlator and transfer view work on desktop and phone', async ({
  page,
}, testInfo) => {
  await page.goto('#fields-paths');
  await page
    .getByRole('button', { name: 'Euclidean QM — Harmonic Oscillator' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Current periodic path x(t)' }),
  ).toBeVisible();
  await expect(page.getByText('● Exact finite lattice')).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  await expect(page.getByTestId('oscillator-effective-gap')).toHaveText('N/A');
  await expect(page.getByTestId('oscillator-gap-status')).toContainText(
    'insufficient samples (1/64 retained paths)',
  );
  const firstPath = await page
    .getByRole('img', { name: /Current periodic path/ })
    .locator('polyline')
    .getAttribute('points');
  await page.getByLabel('Oscillator effective-gap lag').fill('2');
  await page.getByLabel('Oscillator path range').fill('2');
  expect(
    await page
      .getByRole('img', { name: /Current periodic path/ })
      .locator('polyline')
      .getAttribute('points'),
  ).not.toBe(firstPath);
  const displayAdjustedPath = await page
    .getByRole('img', { name: /Current periodic path/ })
    .locator('polyline')
    .getAttribute('points');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  expect(
    await page
      .getByRole('img', { name: /Current periodic path/ })
      .locator('polyline')
      .getAttribute('points'),
  ).toBe(displayAdjustedPath);
  await page.getByLabel('Oscillator omega').fill('2');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('0');
  await expect(page.getByText(/Segment 1: β=8, ω=1, n=1/)).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByText(/Segment 2: β=8, ω=2, n=1/)).toBeVisible();
  await page
    .getByText('Transfer operator, normalization & reflection positivity')
    .click();
  await expect(page.getByTestId('oscillator-quadrature-quality')).toBeVisible();
  await expect(page.getByTestId('oscillator-quadrature-quality')).toContainText(
    'Usable approximation',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/m4b-${testInfo.project.name}.png`,
      fullPage: true,
    });
});

test('fine time spacing and local sampler remain usable', async ({ page }) => {
  await page.goto('#fields-paths');
  await page
    .getByRole('button', { name: 'Euclidean QM — Harmonic Oscillator' })
    .click();
  await page.getByLabel('Oscillator time sites').fill('64');
  await page.getByLabel('Oscillator beta').fill('2');
  await page.getByLabel('Oscillator omega').fill('0.25');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByText(/κ=1\/a=32/)).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  await page
    .getByText('Transfer operator, normalization & reflection positivity')
    .click();
  await expect(page.getByTestId('oscillator-quadrature-quality')).toContainText(
    'Under-resolved approximation',
  );
  await expect(page.getByTestId('oscillator-quadrature-quality')).toContainText(
    '47.',
  );
  await expect(page.getByTestId('oscillator-quadrature-gap')).not.toHaveText(
    'N/A',
  );
  await page.getByLabel('Oscillator sampler').selectOption('heat-bath');
  await page.getByLabel('Oscillator warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByTestId('oscillator-gap-status')).toContainText(
    'Local paths may be autocorrelated',
  );
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('oscillator-updates').textContent()),
    )
    .toBeGreaterThan(64);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});
