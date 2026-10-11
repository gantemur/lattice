import { expect, test } from '@playwright/test';

async function open(page: import('@playwright/test').Page) {
  await page.goto('./#lattice-systems');
  await expect(page.getByTestId('lattice-canvas')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
}
test('2×2 exact reference, true step trace, quench segments and Reset', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-exact')).toContainText(
    '8 distinct bonds',
  );
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  await expect(page.getByTestId('lattice-trace')).toContainText('Update 1');
  const m = await page.getByTestId('lattice-m').textContent();
  await page.getByLabel('Temperature T').fill('4');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('lattice-m')).toHaveText(m!);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 1');
  await expect(page.getByTestId('lattice-updates')).toHaveText('0');
});

test('16, 32 and 64 grids sample in a worker and plots remain display-only', async ({
  page,
}) => {
  await open(page);
  for (const size of ['16', '32', '64']) {
    await page.getByLabel('Size preset').selectOption(size);
    await page.getByRole('button', { name: 'Apply settings' }).click();
    await expect(page.getByTestId('lattice-canvas')).toHaveAttribute(
      'width',
      /\d+/,
    );
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  }
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('lattice-updates').textContent()),
    )
    .toBeGreaterThan(4096);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
  const count = Number(await page.getByTestId('lattice-updates').textContent());
  await page.getByLabel('Measurement window').selectOption('500');
  await page.getByRole('button', { name: 'Add plot' }).click();
  await page.getByRole('button', { name: 'Older' }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText(String(count));
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText(
    String(count + 1),
  );
});

test('phone lattice, settings and plot controls fit width; heat bath labels acceptance N/A', async ({
  page,
  isMobile,
}) => {
  await open(page);
  await page.getByLabel('Sampler').selectOption('heat-bath');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: 'Add plot' }).click();
  await page.getByLabel('Plot 3 type').selectOption('acceptance');
  if (isMobile) await page.getByLabel('Lattice detail plot').selectOption('3');
  await expect(page.getByText('acceptance N/A')).toBeVisible();
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
  await page.getByLabel('Inspect x').fill('3');
  await expect(page.getByLabel('Selected site neighborhood')).toBeVisible();
});

test('workspace navigation preserves both independent sessions', async ({
  page,
}) => {
  await page.goto('./#small-systems');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByRole('link', { name: 'Lattice Systems' }).click();
  await expect(page.getByTestId('lattice-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  await page.getByRole('link', { name: 'Small Systems' }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByRole('link', { name: 'Lattice Systems' }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
});
