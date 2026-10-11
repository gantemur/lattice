import { expect, test } from '@playwright/test';

test('paused Small Systems segment exports and imports identical portable data after reload', async ({
  page,
}) => {
  await page.goto('./#small-systems');
  await expect(page.getByTestId('run-status')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await expect(page.getByText(/Saved 1 acknowledged segment/)).toBeVisible();
  await page.goto('./#experiments');
  await expect(
    page.getByRole('heading', { name: 'Saved records' }),
  ).toBeVisible();
  await expect(page.getByTestId('archive-detail')).toContainText(
    '1 full-segment measurements',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const name = await page.getByLabel('Saved record name').inputValue();
  await page.getByRole('checkbox', { name: `Select ${name}` }).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download selected JSON bundle' }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.reload();
  await expect(page.getByText('No records yet.')).toBeVisible();
  await page.getByLabel('Import experiment JSON').setInputFiles(path!);
  await expect(page.getByTestId('archive-detail')).toContainText(
    '1 full-segment measurements',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel('Saved record name')).toHaveValue(name);
  await page.goto('./#small-systems');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('lattice historical and active segments save separately without mutating live state', async ({
  page,
}) => {
  await page.goto('./#lattice-systems');
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByLabel('Warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await expect(page.getByTestId('lattice-updates')).toHaveText(String(i + 1));
  }
  await expect(page.getByTestId('lattice-samples')).toHaveText('1');
  await page.getByLabel('Temperature T').fill('4');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await page.getByRole('button', { name: 'Save available segments' }).click();
  await expect(
    page.getByText(/Saved 2 acknowledged lattice segments/),
  ).toBeVisible();
  await expect(page.getByTestId('lattice-updates')).toHaveText('4');
  await page.goto('./#experiments');
  await expect(page.locator('.archive-row')).toHaveCount(2);
  await page.locator('.archive-row').first().getByRole('button').click();
  await expect(page.getByTestId('archive-detail')).toContainText(
    'No end-of-segment configuration is archived',
  );
  await expect(page.getByTestId('archive-detail')).toContainText(
    '1 full-segment measurements',
  );
  await page.locator('.archive-row').nth(1).getByRole('button').click();
  await expect(page.getByTestId('archive-detail')).toContainText(
    'Snapshot-only historical segment',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto('./#lattice-systems');
  await expect(page.getByTestId('lattice-updates')).toHaveText('4');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
