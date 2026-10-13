import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
test.describe.configure({ timeout: 90000 });
const step = (page: Page) =>
  page.getByRole('button', { name: 'Step', exact: true });
const updates = (page: Page) => page.getByTestId('phi4-updates');
const deck = (page: Page) =>
  page.getByRole('region', { name: 'Spatial φ⁴ tools', exact: true });
async function open(page: Page) {
  await page.goto('./#fields-paths');
  await page.getByLabel('Field model', { exact: true }).selectOption('phi4');
  await expect(updates(page)).toHaveText('0');
}
async function apply(page: Page) {
  await page
    .getByRole('button', { name: 'Apply spatial settings', exact: true })
    .click();
  await expect(step(page)).toBeEnabled();
}
async function hmc(page: Page) {
  await page.getByLabel('Spatial sampler', { exact: true }).selectOption('hmc');
  await page.getByLabel('Spatial HMC warm-up trajectories').fill('0');
  await apply(page);
  await expect(page.getByTestId('phi4-applied')).toContainText('HMC ε=0.06');
}
async function detail(page: Page, key: string) {
  const select = page.getByLabel('Spatial φ⁴ tools detail tool');
  if (await select.isVisible()) await select.selectOption(key);
}
async function add(page: Page, id: string) {
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  const cards = deck(page).getByTestId('teaching-tool');
  await cards
    .last()
    .getByLabel(`Tool ${await cards.count()} type`)
    .selectOption(id);
  await detail(page, (await cards.last().getAttribute('data-assignment-key'))!);
  return cards.last();
}
async function advance(page: Page, n: number) {
  await step(page).click();
  await expect(updates(page)).toHaveText(String(n));
}
async function runPause(page: Page) {
  const before = Number(await updates(page).textContent());
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () => Number(await updates(page).textContent()))
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
}

test('spatial HMC draft validation, whole-field cadence and real worker diagnostics', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await add(page, 'hmc');
  await expect(
    page.getByRole('region', { name: 'HMC diagnostics', exact: true }),
  ).toContainText('Apply Hamiltonian Monte Carlo');
  await page.getByLabel('Spatial sampler', { exact: true }).selectOption('hmc');
  await expect(page.getByTestId('phi4-applied')).toContainText(
    'Local Metropolis',
  );
  await page.getByLabel('Spatial HMC step size').fill('0.3');
  await page
    .getByRole('button', { name: 'Apply spatial settings', exact: true })
    .click();
  expect(
    await page
      .getByLabel('Spatial HMC step size')
      .evaluate((e: HTMLInputElement) => e.validity.rangeOverflow),
  ).toBe(true);
  await expect(page.getByTestId('phi4-applied')).toContainText(
    'Local Metropolis',
  );
  await page.getByLabel('Spatial HMC step size').fill('0.06');
  await page.getByLabel('Spatial HMC warm-up trajectories').fill('2');
  await page.getByLabel('Spatial HMC measurement stride').fill('3');
  await apply(page);
  await expect(page.getByTestId('phi4-applied')).toContainText(
    'warm-up 2, stride 3 trajectories',
  );
  for (let i = 1; i <= 4; i++) await advance(page, i);
  await expect(page.getByTestId('phi4-samples')).toHaveText('0');
  await advance(page, 5);
  await expect(page.getByTestId('phi4-samples')).toHaveText('1');
  await expect(
    page.getByText(/One Step is one whole-field HMC trajectory/),
  ).toBeVisible();
  const diagnostic = page.getByRole('region', {
    name: 'HMC diagnostics',
    exact: true,
  });
  await expect(diagnostic).toContainText('5 attempted');
  await expect(diagnostic).toContainText('65 force evaluations');
  await expect(diagnostic).toContainText('warm-up');
  await add(page, 'transition');
  const inspection = page.getByRole('region', {
    name: 'Latest spatial HMC trajectory',
  });
  await expect(inspection).toContainText('Complete ΔH');
  await expect(inspection).toContainText('decision uniform');
  await expect(inspection).toContainText('13 force evaluations');
  await expect(inspection).toContainText('Proposed S=');
  await page.getByText('Edit spatial φ⁴ settings', { exact: true }).click();
  await noOverflow(page);
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/m4d2-${info.project.name}.png`,
      fullPage: true,
    });
  expect(errors).toEqual([]);
});

test('spatial HMC display edits, lazy transfer, Reset and acknowledged Run/Pause preserve replay', async ({
  page,
}) => {
  await open(page);
  await hmc(page);
  await advance(page, 1);
  const field = deck(page).getByTestId('featured-tool').locator('polyline');
  const first = await field.getAttribute('points');
  await add(page, 'reference');
  await expect(page.getByTestId('phi4-transfer-status')).toContainText(
    'Leading ratio status: resolved.',
    { timeout: 30000 },
  );
  await add(page, 'hmc');
  await page.getByLabel('Spatial field range').fill('4');
  await page.getByLabel('Spatial field range').fill('3');
  await expect(updates(page)).toHaveText('1');
  expect(await field.getAttribute('points')).toBe(first);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await advance(page, 1);
  expect(await field.getAttribute('points')).toBe(first);
  await runPause(page);
  const paused = Number(await updates(page).textContent());
  await advance(page, paused + 1);
  // Same-geometry algorithm changes preserve the configuration until stepping.
  const before = await field.getAttribute('points');
  await page
    .getByLabel('Spatial sampler', { exact: true })
    .selectOption('metropolis');
  await page.getByLabel('Spatial warm-up sweeps').fill('0');
  await apply(page);
  expect(await field.getAttribute('points')).toBe(before);
  await expect(page.getByTestId('phi4-segment')).toHaveText('2');
  await advance(page, paused + 2);
  await page.getByLabel('Spatial sampler', { exact: true }).selectOption('hmc');
  await expect(page.getByLabel('Spatial HMC step size')).toHaveValue('0.06');
  await apply(page);
  await expect(page.getByTestId('phi4-segment')).toHaveText('3');
  await add(page, 'history');
  await expect(page.getByText(/these are not equal work/)).toBeVisible();
  await page
    .getByLabel('Field model', { exact: true })
    .selectOption('gaussian');
  await expect(page.getByTestId('field-updates')).toHaveText('0');
  await step(page).click();
  await expect(page.getByTestId('field-updates')).toHaveText('1');
  await page.getByLabel('Field model', { exact: true }).selectOption('phi4');
  await expect(page.getByLabel('Spatial sampler', { exact: true })).toHaveValue(
    'metropolis',
  );
  await expect(updates(page)).toHaveText('0');
  await noOverflow(page);
});

test('spatial HMC preserves open, periodic, anisotropic and tiny geometries with actual rejections', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await hmc(page);
  await page.getByLabel('Spatial sites N').fill('2');
  for (const boundary of ['false', 'true']) {
    await page
      .getByLabel('Spatial boundary', { exact: true })
      .selectOption(boundary);
    await apply(page);
    await advance(page, 1);
    await expect(
      page.getByText(
        boundary === 'true' ? '2 sites · 2 bonds' : '2 sites · 1 bonds',
        { exact: true },
      ),
    ).toBeVisible();
  }
  await page.getByLabel('Spatial geometry').selectOption('rectangle');
  await page.getByLabel('Spatial Lx').fill('2');
  await page.getByLabel('Spatial Ly').fill('2');
  await page.getByLabel('Spatial κy').fill('0.5');
  for (const boundary of ['false', 'true']) {
    await page.getByLabel('Spatial boundary X').selectOption(boundary);
    await page.getByLabel('Spatial boundary Y').selectOption(boundary);
    await apply(page);
    await advance(page, 1);
    await page.getByRole('button', { name: /Select site x 1, y 1/ }).click();
    await detail(page, '2');
    await expect(
      page.getByRole('heading', {
        name: 'Selected spatial site 3',
        exact: true,
      }),
    ).toBeVisible();
    await detail(page, '1');
    await expect(
      page.getByRole('region', {
        name: 'Sampled spatial correlations',
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.getByLabel('Spatial boundary Y').selectOption('false');
  await apply(page);
  await advance(page, 1);
  // Deliberately stiff but valid controls produce a real worker rejection.
  await page.getByLabel('Spatial boundary Y').selectOption('true');
  await page.getByLabel('Spatial r', { exact: true }).fill('20');
  await page.getByLabel('Spatial λ', { exact: true }).fill('4');
  await page.getByLabel('Spatial κx', { exact: true }).fill('10');
  await page.getByLabel('Spatial κy', { exact: true }).fill('10');
  await page.getByLabel('Spatial HMC step size').fill('0.25');
  await page.getByLabel('Spatial HMC leapfrog steps').fill('32');
  await apply(page);
  await advance(page, 1);
  await add(page, 'transition');
  const trace = page.getByRole('region', {
    name: 'Latest spatial HMC trajectory',
  });
  await expect(trace).toContainText(/rejected|divergence/);
  await expect(trace).toContainText('A rejection retains the entire old field');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('spatial HMC bounded batches remain responsive at 16/64 sites and 4×4/8×8 with lazy analysis', async ({
  page,
}, info) => {
  await open(page);
  await hmc(page);
  await add(page, 'reference');
  await expect(page.getByTestId('phi4-transfer-status')).toContainText(
    'Leading ratio status: resolved.',
    { timeout: 30000 },
  );
  for (const shape of ['chain16', 'chain64', 'rectangle4', 'rectangle8'])
    for (const L of [12, 32]) {
      const chain = shape.startsWith('chain');
      await page
        .getByLabel('Spatial geometry')
        .selectOption(chain ? 'chain' : 'rectangle');
      if (chain)
        await page
          .getByLabel('Spatial sites N')
          .fill(shape === 'chain16' ? '16' : '64');
      else {
        await page
          .getByLabel('Spatial Lx')
          .fill(shape === 'rectangle4' ? '4' : '8');
        await page
          .getByLabel('Spatial Ly')
          .fill(shape === 'rectangle4' ? '4' : '8');
      }
      // Include strong valid stiffness. Keep epsilon explicit; no automatic tuning.
      await page
        .getByLabel('Spatial κx', { exact: true })
        .fill(chain ? '2' : '10');
      if (!chain)
        await page.getByLabel('Spatial κy', { exact: true }).fill('10');
      await page
        .getByLabel('Spatial HMC step size')
        .fill(chain ? '0.06' : '0.02');
      await page.getByLabel('Spatial HMC leapfrog steps').fill(String(L));
      await apply(page);
      const start = Date.now();
      await runPause(page);
      const elapsed = Date.now() - start;
      console.info(
        'M4d2 acknowledged Run/Pause ms',
        info.project.name,
        shape,
        L,
        elapsed,
      );
      expect(elapsed).toBeLessThan(15000);
      await noOverflow(page);
    }
});
