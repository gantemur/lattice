import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const step = (p: Page) => p.getByRole('button', { name: 'Step', exact: true });
async function start(page: Page) {
  await page.goto('./');
  await page.getByLabel('Named example', { exact: true }).selectOption('ising');
  await expect(step(page)).toBeEnabled();
  await expect(
    page.getByRole('heading', { name: 'Periodic 1×4 chain', exact: true }),
  ).toBeVisible();
  await page
    .getByText('Exact references & diagnostics', { exact: true })
    .click();
}
async function editor(page: Page) {
  if (!(await page.getByLabel('Geometry preset', { exact: true }).isVisible()))
    await page
      .getByText('Geometry & numerical parameters', { exact: true })
      .click();
}
async function sampler(page: Page, kind: string, warmup = '2') {
  if (!(await page.getByLabel('Sampling algorithm').isVisible()))
    await page.getByText('Model & sampler settings', { exact: true }).click();
  await page.getByLabel('Sampling algorithm').selectOption(kind);
  if (kind !== 'direct')
    await page.getByLabel('Warm-up updates', { exact: true }).fill(warmup);
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
  await expect(step(page)).toBeEnabled();
}
async function detail(page: Page, key: number) {
  const select = page.getByLabel('Small Systems tools detail tool');
  if (await select.isVisible()) await select.selectOption(String(key));
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test('all presets expose distinct topology, exact enumeration and local mathematics', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  for (const [kind, name, counts] of [
    ['site', 'Single site', '1 sites · 0 bonds · 0 faces'],
    ['path', 'Open four-site chain', '4 sites · 3 bonds · 0 faces'],
    ['square', 'Open 2×2 square', '4 sites · 4 bonds · 1 faces'],
    ['star', 'Four-site star', '4 sites · 3 bonds · 0 faces'],
    ['complete', 'Complete graph K4', '4 sites · 6 bonds · 0 faces'],
    ['torus', 'Periodic 2×2 square lattice', '4 sites · 8 bonds · 4 faces'],
  ]) {
    await editor(page);
    await page
      .getByLabel('Geometry preset', { exact: true })
      .selectOption(kind!);
    await expect(
      page.getByRole('heading', { name: name!, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(counts!, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('region', {
        name: 'Interactive Ising graph',
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(page.getByTestId('total-updates')).toHaveText('0');
  }
  await expect(page.locator('.graph-edge')).toHaveCount(8);
  await expect(page.locator('.graph-edge[stroke-dasharray]')).toHaveCount(4);
  await page
    .getByText('Exact configuration probabilities (16 states)', { exact: true })
    .click();
  await expect(
    page.getByRole('columnheader', { name: 'Exact P', exact: true }),
  ).toBeVisible();
  await page
    .getByText('The mathematics & suggested experiments', { exact: true })
    .click();
  await expect(
    page.locator('#model-notes .katex-mathml math').first(),
  ).toBeAttached();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('M3a exact graph Markov benchmark compares with recent empirical autocorrelation', async ({
  page,
}) => {
  await start(page);
  await page
    .getByTestId('small-ising-diagnostics')
    .locator('summary')
    .first()
    .click();
  await expect(
    page.getByTestId('small-ising-diagnostics').getByTestId('exact-markov'),
  ).toContainText('Exact τ_int');
  await expect(
    page
      .getByTestId('small-ising-diagnostics')
      .getByTestId('diagnostic-status'),
  ).toContainText('insufficient');
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('sample-count').textContent()),
    )
    .toBeGreaterThan(256);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(
    page.getByRole('img', { name: /Autocorrelation of m/ }),
  ).toBeVisible();
  const count = await page.getByTestId('total-updates').textContent();
  await page.getByLabel('Small Ising diagnostic observable').selectOption('e');
  await expect(page.getByTestId('total-updates')).toHaveText(count!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('M3a graph diagnostic units distinguish local updates, one-site sweeps and direct draws', async ({
  page,
}) => {
  await start(page);
  await sampler(page, 'metropolis');
  const panel = page.getByTestId('small-ising-diagnostics');
  await panel.locator('summary').first().click();
  await expect(panel.getByText('1 elementary site update')).toBeVisible();
  await expect(
    panel.getByText('τ_int · observations = elementary updates'),
  ).toBeVisible();
  await sampler(page, 'direct');
  await panel.locator('summary').first().click();
  await expect(panel.getByText('1 whole-configuration draw')).toBeVisible();
  await expect(panel.getByTestId('diagnostic-tau-sweeps')).toHaveText(
    'N/A for independent draws',
  );
  await expect(panel.getByTestId('exact-markov')).toContainText(
    'per-draw spectral gap',
  );
  await editor(page);
  await page
    .getByLabel('Geometry preset', { exact: true })
    .selectOption('site');
  await sampler(page, 'metropolis');
  await panel.locator('summary').first().click();
  await expect(panel.getByText('1 elementary site update')).toBeVisible();
  await expect(
    panel.getByText('τ_int · observations = elementary updates'),
  ).toBeVisible();
});
test('graph parameter segments preserve configurations and axes; preset changes explicitly reset; zero weights preserve topology', async ({
  page,
}) => {
  await start(page);
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const configuration = await page
    .getByTestId('spin-configuration')
    .textContent();
  const chart = page
      .getByRole('img', { name: 'Exact distribution and sampled histogram' })
      .first(),
    before = JSON.parse((await chart.getAttribute('data-viewport'))!);
  await editor(page);
  await page.getByLabel('Coupling e0', { exact: true }).fill('-1.2');
  await page.getByLabel('Field v1', { exact: true }).fill('0.5');
  await page
    .getByRole('button', { name: 'Apply graph parameters', exact: true })
    .click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('segment-1')).toContainText('N=1');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(page.getByTestId('spin-configuration')).toHaveText(
    configuration!,
  );
  const after = JSON.parse((await chart.getAttribute('data-viewport'))!);
  expect(after.min).toBe(before.min);
  expect(after.max).toBe(before.max);
  await page.getByLabel('Coupling e0', { exact: true }).fill('20');
  await page
    .getByRole('button', { name: 'Apply graph parameters', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('between');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await page
    .getByLabel('Geometry preset', { exact: true })
    .selectOption('complete');
  await expect(
    page.getByRole('heading', { name: 'Complete graph K4', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  await expect(page.getByTestId('segment-2')).toHaveCount(0);
  await editor(page);
  await page.getByLabel('Coupling e0', { exact: true }).fill('0');
  await page.getByLabel('Coupling e1', { exact: true }).fill('-0.8');
  await page
    .getByRole('button', { name: 'Apply graph parameters', exact: true })
    .click();
  await expect(page.locator('.graph-edge')).toHaveCount(6);
  await expect(page.locator('.graph-edge.zero-weight')).toHaveCount(1);
  await expect(page.locator('.graph-edge.negative-weight')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Add bond', exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel('Geometry preset', { exact: true })
    .selectOption('torus');
  await expect(page.locator('.graph-edge')).toHaveCount(8);
  await editor(page);
  await page.getByLabel('Coupling e0', { exact: true }).fill('0');
  await page
    .getByRole('button', { name: 'Apply graph parameters', exact: true })
    .click();
  await expect(
    page.getByText('4 sites · 8 bonds · 4 faces', { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});
test('local samplers exclude warm-up and Step exposes the actual site and neighborhood', async ({
  page,
}) => {
  await start(page);
  await sampler(page, 'metropolis');
  for (let n = 1; n <= 4; n++) {
    await step(page).click();
    await expect(page.getByTestId('segment-updates')).toHaveText(String(n));
    await expect(page.getByTestId('sample-count')).toHaveText(
      String(Math.max(0, n - 2)),
    );
  }
  await expect(page.getByTestId('transition-details')).toContainText(
    'Selected vertex',
  );
  await expect(page.getByTestId('transition-details')).toContainText(
    'proposal draw',
  );
  await expect(page.locator('.updated-site')).toHaveCount(1);
  await sampler(page, 'heat-bath', '1');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByTestId('transition-details')).toContainText(
    'conditional on neighbors',
  );
  await expect(page.getByTestId('transition-details')).toContainText(
    'No Metropolis acceptance test',
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  await expect(page.getByTestId('spin-configuration')).toContainText(
    '1, 1, 1, 1',
  );
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  await step(page).click();
  const trace = await page.getByTestId('transition-details').textContent();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await step(page).click();
  await expect(page.getByTestId('transition-details')).toHaveText(trace!);
  await noOverflow(page);
});
test('graph selection and six observable views do not mutate the paused experiment', async ({
  page,
}, info) => {
  await start(page);
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const state = await page.getByTestId('spin-configuration').textContent();
  await page.getByRole('button', { name: /Select vertex v2,/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Selected site', { exact: true })).toHaveValue(
    'v2',
  );
  const add = page.getByRole('button', { name: 'Add tool', exact: true });
  await add.click();
  const card3 = page
    .getByRole('region', { name: 'Small Systems tools' })
    .getByTestId('teaching-tool')
    .filter({ has: page.getByLabel('Tool 3 type') });
  await card3.getByLabel('Tool 3 type').selectOption('conditional');
  await expect(card3.getByLabel('Observable for tool 3')).toHaveValue('v2');
  await expect(
    page.getByRole('heading', {
      name: 'v2 · conditional at current neighbors',
    }),
  ).toBeVisible();
  for (let i = 4; i <= 6; i++) {
    await add.click();
    await page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByLabel(`Tool ${i} type`)
      .selectOption(i === 4 ? 'correlation' : i === 5 ? 'mean' : 'density');
    if (i >= 5)
      await page.getByLabel(`Observable for tool ${i}`).selectOption('E');
  }
  await expect(add).toBeDisabled();
  await detail(page, 4);
  await expect(
    page.getByText(
      'Connected correlations · exact / sampled (current segment)',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel('Connected correlations', { exact: true }).uncheck();
  await expect(
    page.getByText('Pair correlations · exact / sampled (current segment)', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId('independent-band')).toHaveCount(0);
  await detail(page, 6);
  await page
    .getByRole('region', { name: 'Small Systems tools' })
    .getByTestId('teaching-tool')
    .filter({ has: page.getByLabel('Tool 6 type') })
    .getByRole('button', { name: /Move earlier/ })
    .click();
  await detail(page, 4);
  await page
    .getByRole('region', { name: 'Small Systems tools' })
    .getByTestId('teaching-tool')
    .filter({ has: page.getByLabel('Tool 4 type') })
    .getByRole('button', { name: /Collapse/ })
    .click();
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
  await expect(page.getByTestId('spin-configuration')).toHaveText(state!);
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath('ising-observables.png'),
    fullPage: true,
  });
});
test('Run, pause and inspect retain graph history across thousands of worker updates', async ({
  page,
}) => {
  await start(page);
  await sampler(page, 'heat-bath', '10');
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('total-updates').textContent()),
    )
    .toBeGreaterThanOrEqual(2048);
  await editor(page);
  await page.getByLabel('Coupling e0', { exact: true }).fill('0.3');
  const editingUpdate = Number(
    await page.getByTestId('total-updates').textContent(),
  );
  await expect
    .poll(async () =>
      Number(await page.getByTestId('total-updates').textContent()),
    )
    .toBeGreaterThan(editingUpdate + 128);
  await expect(page.getByLabel('Coupling e0', { exact: true })).toHaveValue(
    '0.3',
  );
  await page
    .getByText('Geometry & numerical parameters', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  const n = Number(await page.getByTestId('total-updates').textContent());
  await expect(page.getByTestId('sample-count')).toHaveText(String(n - 10));
  await step(page).click();
  await expect(page.getByTestId('total-updates')).toHaveText(String(n + 1));
  await detail(page, 2);
  await expect(page.getByTestId('trajectory-retention')).toContainText(
    '100 exact transitions shown',
  );
  await noOverflow(page);
});

test('local selection, edit handoff and log-error inspection preserve seeded sampling', async ({
  page,
}) => {
  await start(page);
  await sampler(page, 'heat-bath', '0');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await step(page).click();
  const state = await page.getByTestId('spin-configuration').textContent();
  await page.getByLabel('Selected site', { exact: true }).selectOption('v2');
  await expect(page.locator('.graph-vertex.selected')).toHaveCount(1);
  await page.getByRole('button', { name: /Select vertex v1,/ }).click();
  await expect(page.getByLabel('Selected site', { exact: true })).toHaveValue(
    'v1',
  );
  await page.getByText('Local graph inspection', { exact: true }).click();
  const site = page.getByTestId('selected-site-panel');
  await site.locator('summary').click();
  await expect(site).toContainText(
    'Conditional on the current neighbors, not the equilibrium marginal',
  );
  await expect(site.locator('.katex-mathml')).toHaveCount(4);
  await page.getByRole('button', { name: /Select bond e2,/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Selected bond', { exact: true })).toHaveValue(
    'e2',
  );
  const bond = page.getByTestId('selected-bond-panel');
  await bond.locator('summary').click();
  await expect(bond).toContainText('endpoint spins');
  await page
    .getByRole('button', { name: 'Edit coupling e2', exact: true })
    .click();
  await expect(page.getByLabel('Coupling e2', { exact: true })).toBeFocused();
  await detail(page, 1);
  await page
    .getByRole('region', { name: 'Small Systems tools' })
    .getByLabel('Tool 1 type')
    .selectOption('error');
  const chart = page.getByRole('img', {
    name: 'Log–log absolute error of running mean',
    exact: true,
  });
  await expect(page.getByLabel('Current absolute errors')).toContainText(
    'N = 1',
  );
  await expect(page.getByLabel('Current absolute errors')).toContainText(
    'current absolute error:',
  );
  const viewport = await chart.getAttribute('data-viewport');
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
  await expect(chart).toHaveAttribute('data-viewport', viewport!);
  await expect(page.getByTestId('spin-configuration')).toHaveText(state!);
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  await step(page).click();
  await expect(page.getByTestId('total-updates')).toHaveText('2');
  const nextTrace = await page.getByTestId('transition-details').textContent();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await step(page).click();
  await step(page).click();
  await expect(page.getByTestId('transition-details')).toHaveText(nextTrace!);
  await page.getByLabel('Coupling e2', { exact: true }).fill('-0.7');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 1');
  await page
    .getByRole('button', { name: 'Apply graph parameters', exact: true })
    .click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(bond).toContainText('K = -0.7');
  await expect(page.getByTestId('segment-1')).toBeVisible();
  await noOverflow(page);
});
