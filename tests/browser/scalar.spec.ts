import { expect, test } from '@playwright/test';
async function start(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page
    .getByLabel('Named example', { exact: true })
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
async function openLocalInspection(page: import('@playwright/test').Page) {
  const section = page.getByText('Local scalar inspection', { exact: true });
  if (!(await page.getByTestId('scalar-site-panel').isVisible()))
    await section.click();
}
async function openReferences(page: import('@playwright/test').Page) {
  const section = page.getByTestId('small-scalar-references');
  if (!(await section.locator('.moments-panel').isVisible()))
    await section.locator('summary').first().click();
}
async function showTool(page: import('@playwright/test').Page, index: number) {
  const selector = page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel(`Tool ${index} type`);
  if (!(await selector.isVisible()))
    await page
      .getByLabel('Real scalar tools detail tool')
      .selectOption(String(index));
}
test('coupled Gaussian graph, exact reference, direct vector draw and conditional distinction', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await openReferences(page);
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
  await openLocalInspection(page);
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
  await openReferences(page);
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
  await showTool(page, 2);
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 2 type')
    .selectOption('bare');
  await expect(
    page.getByRole('img', { name: 'Bare local potential' }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 2 type')
    .selectOption('conditional-density');
  await expect(
    page
      .getByRole('region', { name: 'Real scalar tools' })
      .getByText('This is not the equilibrium marginal.', { exact: false })
      .last(),
  ).toBeVisible();
  const before = await page.getByTestId('scalar-configuration').textContent();
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
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
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await showTool(page, 3);
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 3 type')
    .selectOption('covariance');
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
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
test('scalar topology changes discard a selected bond from the previous graph', async ({
  page,
}) => {
  await start(page);
  await openParameters(page);
  await page.getByLabel('Scalar geometry').selectOption('torus');
  const featured = page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByTestId('featured-tool');
  await featured.getByRole('button', { name: /Select bond e6,/ }).click();
  await expect(featured.getByLabel('Selected bond')).toHaveValue('e6');

  await openParameters(page);
  await page.getByLabel('Scalar geometry').selectOption('pair');
  await expect(featured).toContainText('Coupled Gaussian pair');
  await expect(
    featured.getByRole('button', { name: /Select bond e0,/ }),
  ).toBeVisible();
  await expect(featured.getByLabel('Selected bond')).toHaveValue('e0');
  await openLocalInspection(page);
  await expect(page.getByLabel('Inspect bond')).toHaveValue('e0');
  await expect(page.getByTestId('scalar-bond-panel')).toContainText('Bond e0');
  await page.getByTestId('scalar-bond-panel').locator('summary').click();
  await page.getByRole('button', { name: 'Edit coupling e0' }).click();
  await expect(page.getByLabel('Coupling e0')).toBeFocused();

  await openParameters(page);
  await page.getByLabel('Scalar geometry').selectOption('site');
  await expect(featured).toContainText('Single site');
  await expect(
    featured.getByRole('button', { name: /Select bond/ }),
  ).toHaveCount(0);
  await expect(featured.getByLabel('Selected bond')).toHaveValue('');
  await expect(page.getByLabel('Inspect bond')).toHaveValue('');
  await expect(page.getByTestId('scalar-bond-panel')).toHaveCount(0);
  await expect(page.getByLabel('Coupling e0')).toHaveCount(0);
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
  await openReferences(page);
  await expect(
    page
      .getByTestId('small-scalar-references')
      .getByText('Sampled only', { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await openLocalInspection(page);
  await page.getByTestId('scalar-site-panel').locator('summary').click();
  await expect(page.getByTestId('scalar-site-panel')).toContainText(
    'This is not the equilibrium marginal',
  );
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Observable for tool 1')
    .selectOption('v0·v1');
  await showTool(page, 2);
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 2 type')
    .selectOption('covariance');
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
  await showTool(page, 2);
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 2 type')
    .selectOption('mean');
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
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
  await expect(page.getByTestId('total-updates')).toHaveText('2');
});

test('long direct run keeps 100 recent points spread across a browsable update window', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await start(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const firstTrace = await page
    .getByTestId('scalar-transition-details')
    .textContent();
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(
      async () => Number(await page.getByTestId('total-updates').textContent()),
      { timeout: 90_000 },
    )
    .toBeGreaterThanOrEqual(20_000);
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
  const total = Number(await page.getByTestId('total-updates').textContent());
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  const chart = page.getByRole('img', {
    name: 'Scalar sample trajectory by elementary update',
  });
  await expect(chart).toBeVisible();
  const viewport = JSON.parse((await chart.getAttribute('data-viewport'))!);
  expect([viewport.firstShown, viewport.lastShown]).toEqual([
    total - 100,
    total,
  ]);
  await expect(chart).toContainText(total.toLocaleString('en'));
  await expect(chart.getByTestId('scalar-point')).toHaveCount(100);
  await expect(chart.getByTestId('scalar-step')).toHaveCount(0);
  const points = await chart.getByTestId('scalar-point').all();
  const firstX = Number(await points[0]!.getAttribute('cx'));
  const lastX = Number(await points.at(-1)!.getAttribute('cx'));
  expect(lastX - firstX).toBeGreaterThan(100);
  const plot = page
    .getByRole('region', { name: 'Real scalar tools' })
    .locator('[data-testid="teaching-tool"][data-assignment-key="3"]');
  await plot.getByText('Window & history', { exact: true }).click();
  await plot.getByLabel('Scalar trajectory window').selectOption('500');
  await expect(chart.getByTestId('scalar-point')).toHaveCount(500);
  await plot.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(plot.getByLabel('Scalar trajectory end update')).toHaveValue(
    String(total - 500),
  );
  await expect(plot.getByTestId('scalar-trajectory-retention')).toContainText(
    'Earliest retained update',
  );
  await plot.getByLabel('Scalar trajectory window').selectOption('1000');
  await plot.getByLabel('Scalar trajectory end update').fill('1');
  const earliest = total - 999;
  await expect(plot.getByLabel('Scalar trajectory end update')).toHaveValue(
    String(earliest),
  );
  await expect(
    plot.getByRole('button', { name: 'Older', exact: true }),
  ).toBeDisabled();
  await expect(chart.getByTestId('scalar-point')).toHaveCount(1);
  await plot.getByRole('button', { name: 'Newer', exact: true }).click();
  await plot.getByLabel('Follow latest').check();
  await expect(plot.getByLabel('Scalar trajectory end update')).toHaveValue(
    String(total),
  );
  await expect(page.getByTestId('total-updates')).toHaveText(String(total));
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
  await expect(page.getByTestId('total-updates')).toHaveText(String(total));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('scalar-transition-details')).toHaveText(
    firstTrace!,
  );
});

test('scalar acceptance bars separate Metropolis from direct and heat-bath N/A', async ({
  page,
}) => {
  await start(page);
  await showTool(page, 2);
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 2 type')
    .selectOption('acceptance');
  const diagnostics = page.getByRole('group', {
    name: 'Real scalar acceptance diagnostics',
  });
  await expect(diagnostics).toContainText('Acceptance N/A');
  await expect(diagnostics.locator('.acceptance-bar')).toHaveCount(0);
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await page.getByLabel('Sampling algorithm').selectOption('heat-bath');
  await page.getByLabel('Warm-up updates').fill('0');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(diagnostics).toContainText(
    'coordinate Gaussian heat-bath resamplings',
  );
  await expect(diagnostics.locator('.acceptance-bar')).toHaveCount(0);
  await page.getByLabel('Sampling algorithm').selectOption('metropolis');
  await page.getByLabel('Proposal half-width δ').fill('50');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('total-updates').textContent()),
    )
    .toBeGreaterThanOrEqual(300);
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(diagnostics.locator('.acceptance-bar')).toHaveCount(1);
  await expect(diagnostics).toContainText('% accepted');
  await expect(diagnostics).toContainText('rejected proposals');
  await expect(diagnostics).toContainText('including 0 warm-up');
  await expect(diagnostics).toContainText('S1');
  await expect(diagnostics).toContainText('S2');
  await expect(diagnostics).toContainText('S3');
  await page
    .getByRole('region', { name: 'Real scalar tools' })
    .getByLabel('Tool 2 type')
    .selectOption('trajectory');
  const chart = page.getByRole('img', {
    name: 'Scalar sample trajectory by elementary update',
  });
  await expect
    .poll(async () => chart.getByTestId('scalar-step').count())
    .toBeGreaterThan(0);
  await expect
    .poll(async () => chart.getByTestId('scalar-rejection').count())
    .toBeGreaterThan(0);
  const total = await page.getByTestId('total-updates').textContent();
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
  await expect(page.getByTestId('total-updates')).toHaveText(total!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
