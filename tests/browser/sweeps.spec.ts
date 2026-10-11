import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('independent sweep runs, compares and imports portable data on desktop and phone', async ({
  page,
}, testInfo) => {
  await page.goto('./#experiments');
  const sweep = page.getByRole('region', { name: 'Parameter sweeps' });
  await expect(
    page.getByRole('heading', { name: 'Independent 2D Ising sweeps' }),
  ).toBeVisible();
  await sweep.getByText('Edit sweep plan').click();
  await sweep.getByLabel('Ordered values').fill('2, 3');
  await sweep.getByLabel('Sweep base horizontal sites').fill('2');
  await sweep.getByLabel('Sweep base vertical sites').fill('2');
  await sweep.getByLabel('Point warm-up (sweeps)').fill('0');
  await sweep.getByLabel('Measurements / point').fill('64');
  await expect(page.getByTestId('sweep-budget')).toContainText(
    '512 elementary updates',
  );
  await page.getByRole('button', { name: 'Start sweep' }).click();
  await expect(page.getByTestId('sweep-progress')).toContainText('completed', {
    timeout: 30000,
  });
  await expect(page.getByText(/2 completed point\(s\) archived/)).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Compare Temperature scan' })
    .check();
  await expect(
    page.getByRole('img', { name: /physical numeric spacing/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Temperature scan #1' }),
  ).toContainText('64');
  if (
    process.env.CAPTURE_SWEEP_SCREENSHOTS &&
    testInfo.project.name !== 'mobile-webkit'
  )
    await page.screenshot({
      path: `docs/screenshots/m3b2-${testInfo.project.name}.png`,
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download sweep JSON' }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.reload();
  await expect(page.getByText('No sweep archived yet.')).toBeVisible();
  await page.getByLabel('Import experiment JSON').setInputFiles(path!);
  await expect(page.getByText(/1 sweep\(s\)/)).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Compare Temperature scan' })
    .check();
  await expect(
    page.getByRole('img', { name: /physical numeric spacing/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('default temperature preset stays within the archive budget', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Local desktop resource sample',
  );
  await page.goto('./#experiments');
  const started = performance.now();
  await page.getByRole('button', { name: 'Start sweep' }).click();
  await expect(page.getByText(/7 completed point\(s\) archived/)).toBeVisible({
    timeout: 90000,
  });
  const elapsed = performance.now() - started;
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download sweep JSON' }).click(),
  ]);
  const data = await readFile((await download.path())!);
  const bundle = JSON.parse(data.toString());
  expect(bundle.records).toHaveLength(7);
  expect(bundle.sweeps[0].points).toHaveLength(7);
  expect(data.byteLength).toBeLessThan(12 * 1024 * 1024);
  console.log(
    `M3b2 local default scan: ${elapsed.toFixed(0)} ms for 637,952 requested updates; ${data.byteLength} JSON bytes.`,
  );
});

test('sweep execution leaves both mounted interactive workspaces untouched', async ({
  page,
}) => {
  await page.goto('./#small-systems');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.goto('./#lattice-systems');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  await page.goto('./#experiments');
  const sweep = page.getByRole('region', { name: 'Parameter sweeps' });
  await sweep.getByText('Edit sweep plan').click();
  await sweep.getByLabel('Ordered values').fill('2, 3');
  await sweep.getByLabel('Sweep base horizontal sites').fill('2');
  await sweep.getByLabel('Sweep base vertical sites').fill('2');
  await sweep.getByLabel('Point warm-up (sweeps)').fill('0');
  await sweep.getByLabel('Measurements / point').fill('8');
  await sweep.getByRole('button', { name: 'Start sweep' }).click();
  await expect(
    sweep.getByText(/2 completed point\(s\) archived/),
  ).toBeVisible();
  await page.goto('./#small-systems');
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.goto('./#lattice-systems');
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
});
