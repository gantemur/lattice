import { expect, test } from '@playwright/test';

async function open(page: import('@playwright/test').Page) {
  await page.goto('./#lattice-systems');
  await expect(page.getByTestId('lattice-canvas')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
}
async function openTechnical(page: import('@playwright/test').Page) {
  const details = page.locator('.lattice-technical-details');
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
    await details.locator('summary').first().click();
}

test('2×2 exact reference, true step trace, quench segments and Reset', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await openTechnical(page);
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

test('valid low-temperature 2×2 reference renders through Step and Run without a React error', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByLabel('Temperature T').fill('0.05');
  await page.getByLabel('Horizontal Jx').fill('10');
  await page.getByLabel('Vertical Jy').fill('10');
  await page.getByLabel('Field h').fill('10');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await openTechnical(page);
  const reference = page.getByTestId('lattice-exact');
  await expect(reference).toBeVisible();
  await expect(reference).toContainText('8 distinct bonds');
  await expect(reference).not.toContainText('Infinity');
  await expect(reference).not.toContainText('NaN');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  await expect(page.getByTestId('lattice-trace')).toContainText('Update 1');
  await expect(page.getByText('Actual transition ΔH / ΔS')).toBeVisible();
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('lattice-updates').textContent()),
    )
    .toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(reference).toBeVisible();
  expect(errors).toEqual([]);
});

test('Tc example sets the isotropic zero-field draft, then Apply starts a segment', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Horizontal Jx').fill('-3');
  await page.getByLabel('Vertical Jy').fill('2');
  await page.getByLabel('Field h').fill('1');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await page.getByRole('button', { name: 'Tc example · J=1, h=0' }).click();
  await expect(page.getByLabel('Horizontal Jx')).toHaveValue('1');
  await expect(page.getByLabel('Vertical Jy')).toHaveValue('1');
  await expect(page.getByLabel('Field h')).toHaveValue('0');
  await expect(page.getByLabel('Temperature T')).toHaveValue(
    '2.269185314213022',
  );
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 3');
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
  await page.getByRole('button', { name: 'Add tool' }).click();
  await page.getByLabel('Follow latest').uncheck();
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
  await page
    .getByRole('complementary', { name: 'Lattice settings' })
    .getByLabel('Sampler')
    .selectOption('heat-bath');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: 'Add tool' }).click();
  await page.getByLabel('Tool 3 type').selectOption('acceptance');
  if (isMobile) await page.getByLabel('Lattice Systems tools detail tool').selectOption('3');
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

test('M3a exact and sampled 2×2 fluctuation observables and constant diagnostic', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByLabel('Horizontal Jx').fill('0');
  await page.getByLabel('Vertical Jy').fill('0');
  await page.getByLabel('Field h').fill('0');
  await page.getByLabel('Temperature T').fill('2');
  await page.getByLabel('Warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await openTechnical(page);
  const table = page.getByTestId('lattice-equilibrium-observables');
  await expect(table.getByRole('row', { name: /χ =/ })).toContainText('0.5');
  await expect(table.getByRole('row', { name: /U₄ =/ })).toContainText(
    '0.1667',
  );
  await page
    .getByTestId('lattice-diagnostics')
    .locator('summary')
    .first()
    .click();
  await expect(page.getByTestId('diagnostic-status')).toContainText(
    'insufficient',
  );
  await page.getByLabel('Diagnostic observable').selectOption('e');
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('lattice-updates').textContent()),
    )
    .toBeGreaterThan(20000);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(page.getByTestId('diagnostic-status')).toContainText('constant');
  await expect(
    table.getByRole('row', { name: /χ =/ }).locator('td').first(),
  ).not.toHaveText('—');
  await expect(
    table.getByRole('row', { name: /U₄ =/ }).locator('td').first(),
  ).not.toHaveText('—');
  await page.getByLabel('Diagnostic observable').selectOption('m');
  await expect(
    page.getByRole('img', { name: /Autocorrelation of m/ }),
  ).toBeVisible();
  await expect(page.getByTestId('exact-markov')).toContainText('Exact τ_int');
  await page
    .getByRole('complementary', { name: 'Lattice settings' })
    .getByLabel('Sampler')
    .selectOption('heat-bath');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('diagnostic-status')).toContainText(
    'insufficient',
  );
  await expect(page.getByTestId('exact-markov')).toContainText('Exact τ_int');
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('lattice-samples').textContent()),
    )
    .toBeGreaterThan(64);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(page.getByTestId('diagnostic-coverage')).toContainText('/');
});

test('M3a autocorrelation plots and quench statistics remain segment-local and display-only', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Size preset').selectOption('16');
  await page.getByLabel('Warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('lattice-samples').textContent()),
    )
    .toBeGreaterThan(64);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await openTechnical(page);
  await page
    .getByTestId('lattice-diagnostics')
    .locator('summary')
    .first()
    .click();
  await expect(page.getByTestId('diagnostic-coverage')).toContainText('/');
  const before = await page.getByTestId('lattice-updates').textContent();
  await page.getByRole('button', { name: 'Add tool' }).click();
  await page.getByLabel('Tool 3 type').selectOption('m-acf');
  if (await page.getByLabel('Lattice Systems tools detail tool').isVisible())
    await page.getByLabel('Lattice Systems tools detail tool').selectOption('3');
  await expect(
    page.getByRole('img', { name: /Autocorrelation of m/ }).first(),
  ).toBeVisible();
  await page.getByLabel('Tool 3 type').selectOption('spatial-x');
  await expect(
    page.getByRole('img', { name: /pair correlation/ }),
  ).toBeVisible();
  await expect(page.getByTestId('lattice-updates')).toHaveText(before!);
  await page.getByLabel('Temperature T').fill('4');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('diagnostic-status')).toContainText(
    'insufficient',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('M3a sweep cadence and spatial labels respect mixed boundaries', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByLabel('Warm-up sweeps').fill('0');
  await page.getByLabel('Measure every sweeps').fill('3');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await openTechnical(page);
  const diagnostics = page.getByTestId('lattice-diagnostics');
  await diagnostics.locator('summary').first().click();
  await expect(diagnostics.getByText('3 nominal sweep(s)')).toBeVisible();
  await expect(
    diagnostics.getByText('τ_int · retained measurements'),
  ).toBeVisible();
  await expect(diagnostics.getByTestId('exact-markov')).toContainText(
    'retained measurements',
  );
  await page.getByLabel('Size preset').selectOption('4');
  await page.getByLabel('Periodic y').uncheck();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: 'Add tool' }).click();
  await page.getByLabel('Tool 3 type').selectOption('spatial-x');
  await expect(
    page.getByRole('img', { name: /^Raw x-axis pair correlation/ }),
  ).toBeVisible();
  await page.getByLabel('Periodic y').check();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: 'Add tool' }).click();
  await page.getByLabel('Tool 3 type').selectOption('spatial-x');
  await expect(
    page.getByRole('img', { name: /^Connected x-axis pair correlation/ }),
  ).toBeVisible();
  await page.getByLabel('Periodic x').uncheck();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: 'Add tool' }).click();
  await page.getByLabel('Tool 3 type').selectOption('spatial-y');
  await expect(
    page.getByRole('img', { name: /^Raw y-axis pair correlation/ }),
  ).toBeVisible();
});
