import { expect, test } from '@playwright/test';

test('loads the production subpath, worker and hash link after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
    if (response.url().includes('/assets/')) assets.push(response.url());
  });
  await page.goto('./#small-systems');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Small systems. Clear ideas.',
  );
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  expect(errors).toEqual([]);
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every((url) => url.includes('/lattice/assets/'))).toBe(true);
  expect(assets.some((url) => url.includes('simulation.worker'))).toBe(true);
  await expect(
    page.getByRole('navigation', { name: 'Workspaces' }).getByRole('link'),
  ).toHaveCount(1);
});

test('seed replay and settings visibility preserve numerical state', async ({
  page,
}) => {
  await page.goto('./');
  const step = page.getByRole('button', { name: 'Step', exact: true });
  await step.click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const first = await page.getByTestId('current-0').textContent();
  const settings = page.getByText('Model & sampler settings', { exact: true });
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Random seed', { exact: true })).toBeVisible();
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByLabel('Random seed', { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel('Histogram', { exact: true }).uncheck();
  await page.getByLabel('Histogram', { exact: true }).check();
  await expect(page.getByTestId('current-0')).toHaveText(first!);
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(step).toBeEnabled();
  await step.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByTestId('current-0')).toHaveText(first!);
});

test('rejects invalid parameters and starts a fresh segment for a new measure', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await page.getByLabel('Quadratic coefficient').fill('0');
  await page.getByRole('button', { name: 'Apply & start new segment' }).click();
  await expect(page.getByRole('alert')).toContainText('a must be positive');
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByLabel('Quadratic coefficient').fill('4');
  await page.getByLabel('Source h', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Apply & start new segment' }).click();
  await expect(page.getByTestId('exact-mean')).toHaveText('0.5');
  await expect(page.getByTestId('exact-variance')).toHaveText('0.25');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(page.getByTestId('sample-mean')).toHaveText('—');
  await page.getByRole('button', { name: 'Standard Gaussian preset' }).click();
  await expect(page.getByTestId('exact-mean')).toHaveText('0');
  await expect(page.getByTestId('exact-variance')).toHaveText('1');
});

test('run and pause acknowledge a batch before a single step', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('sample-count').textContent()),
    )
    .toBeGreaterThanOrEqual(128);
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('Paused');
  const paused = Number(await page.getByTestId('sample-count').textContent());
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText(String(paused + 1));
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('Paused');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
});

test('four slots stay separate from geometry and fit portrait and landscape', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(
    page.getByRole('article', { name: /Plot slot/, includeHidden: true }),
  ).toHaveCount(4);
  await expect(
    page.getByRole('img', {
      name: 'One site v0 carrying one real variable x, with no links',
    }),
  ).toBeVisible();
  const mobile = testInfo.project.name !== 'desktop';
  if (mobile) {
    await expect(
      page.getByRole('article', { name: 'Plot slot 1', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Plot slot 2', exact: true }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Slot 2', exact: true }).click();
  }
  await page
    .getByLabel('Variable for slot 2', { exact: true })
    .selectOption('x');
  if (mobile)
    await page
      .getByRole('button', { name: '2 × 2 overview', exact: true })
      .click();
  for (const slot of [1, 2, 3, 4])
    await expect(
      page.getByRole('article', { name: `Plot slot ${slot}`, exact: true }),
    ).toBeVisible();
  await expect(page.getByTestId('current-1')).toHaveText(
    (await page.getByTestId('current-0').textContent())!,
  );
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('overview.png'),
    fullPage: true,
  });
  if (mobile) {
    await page
      .getByRole('button', { name: 'Single detail', exact: true })
      .click();
    await page.getByRole('button', { name: 'Slot 1', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath('detail.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 780, height: 360 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByTestId('sample-count')).toHaveText('1');
  }
});

test('reports a failed worker and recovers through Reset', async ({ page }) => {
  await page.route('**/simulation.worker-*.js', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Reset');
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/simulation.worker-*.js');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
