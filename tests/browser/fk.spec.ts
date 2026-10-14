import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
test.describe.configure({ timeout: 90000 });
const root = (p: Page) => p.locator('.potts-workspace:visible');
const feature = (p: Page) => root(p).getByTestId('featured-tool');
const button = (p: Page, name: string) =>
  root(p).getByRole('button', { name, exact: true });
const updates = (p: Page) => root(p).getByTestId('potts-updates');
async function settings(p: Page) {
  if (!(await root(p).getByLabel('Potts q', { exact: true }).isVisible()))
    await root(p).getByText('Potts settings', { exact: true }).click();
}
async function open(p: Page) {
  await p.goto('./#small-systems');
  await p
    .getByLabel('Named example', { exact: true })
    .selectOption('potts-fk-torus');
  await expect(button(p, 'Step')).toBeEnabled();
  await settings(p);
}
async function show(p: Page, id: string) {
  await root(p).getByLabel('Potts tools featured tool').selectOption(id);
}
async function apply(p: Page) {
  await button(p, 'Apply Potts settings').click();
  await expect(button(p, 'Step')).toBeEnabled();
}
async function step(p: Page, n: number) {
  await button(p, 'Step').click();
  await expect(updates(p)).toHaveText(String(n));
}
async function layout(p: Page) {
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
}
function errors(p: Page) {
  const result: string[] = [];
  p.on('pageerror', (e) => result.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') result.push(m.text());
  });
  return result;
}

test('FK discovery, eight distinct bonds, exact inspector, representation exchange and seeded display replay', async ({
  page,
}, info) => {
  const error = errors(page);
  await open(page);
  await expect(feature(page)).toContainText(
    '8 physical bonds · 4 oriented faces',
  );
  await expect(
    feature(page).getByLabel('Potts selected bond').locator('option'),
  ).toHaveCount(8);
  await step(page, 1);
  await expect(root(page).getByTestId('potts-samples')).toHaveText('1');
  await root(page).getByText('Potts settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5d-small-${info.project.name}.png`,
    fullPage: true,
  });
  await feature(page).getByLabel('Potts selected bond').selectOption('e6');
  await expect(feature(page).getByTestId('fk-bond')).toContainText('Bond e6');
  await feature(page).getByLabel('FK display').selectOption('colors');
  await root(page)
    .getByRole('button', {
      name: 'Exact FK and Edwards–Sokal: Feature',
      exact: true,
    })
    .click();
  await expect(feature(page).getByTestId('fk-exact')).toContainText(
    '256 bond words',
  );
  await feature(page).getByLabel('Exact FK bond word').fill('255');
  await expect(feature(page)).toContainText('k=1, occupied=8');
  await root(page)
    .getByRole('button', {
      name: 'FK bonds and clusters: Feature',
      exact: true,
    })
    .click();
  await expect(feature(page).getByLabel('FK display')).toHaveValue('colors');
  await show(page, 'transition');
  const original = await feature(page).getByTestId('fk-transition').innerText();
  await show(page, 'history');
  await feature(page)
    .getByLabel('Potts history observable')
    .selectOption('fk.clusters');
  await button(page, 'Add tool').click();
  await button(page, 'Add tool').click();
  await button(page, 'Add tool').click();
  await button(page, 'Add tool').click();
  await expect(button(page, 'Add tool')).toBeDisabled();
  await button(page, 'Reset').click();
  await expect(updates(page)).toHaveText('0');
  await step(page, 1);
  await show(page, 'transition');
  expect(await feature(page).getByTestId('fk-transition').innerText()).toBe(
    original,
  );
  await show(page, 'fk-configuration');
  await layout(page);

  expect(error).toEqual([]);
});

test('FK eligibility is atomic; dimer/triangle references and original Potts algorithms remain available', async ({
  page,
}) => {
  const error = errors(page);
  await open(page);
  await step(page, 1);
  await root(page).getByLabel('Potts source h', { exact: true }).fill('.2');
  await apply(page);
  await expect(root(page).getByRole('alert')).toContainText('h=0');
  await expect(updates(page)).toHaveText('1');
  await root(page)
    .getByLabel('Potts sampler', { exact: true })
    .selectOption('heat-bath');
  await apply(page);
  await show(page, 'fk-reference');
  await expect(feature(page)).toContainText('h=0');
  await root(page).getByLabel('Potts source h', { exact: true }).fill('0');
  await root(page).getByLabel('Potts K e0', { exact: true }).fill('-1');
  await apply(page);
  await expect(feature(page)).toContainText('K≥0');
  await root(page)
    .getByLabel('Potts sampler', { exact: true })
    .selectOption('sw');
  await apply(page);
  await expect(root(page).getByRole('alert')).toContainText('K≥0');
  for (const [geometry, words] of [
    ['dimer', '2'],
    ['triangle', '8'],
  ] as const) {
    await root(page).getByLabel('Potts graph geometry').selectOption(geometry);
    await apply(page);
    await expect(updates(page)).toHaveText('0');
    await expect(feature(page).getByTestId('fk-exact')).toContainText(
      `${words} bond words`,
    );
    await step(page, 1);
  }
  await root(page)
    .getByLabel('Potts sampler', { exact: true })
    .selectOption('direct');
  await apply(page);
  await show(page, 'fk-configuration');
  await expect(feature(page)).toContainText('Sampled FK data are unavailable');
  await step(page, 2);
  await show(page, 'transition');
  await expect(feature(page)).toContainText('direct: draw');
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('potts-triangle');
  await expect(button(page, 'Step')).toBeEnabled();
  await settings(page);
  await show(page, 'reference');
  await expect(feature(page).getByTestId('potts-frustration')).toBeVisible();
  await root(page).getByLabel('Potts K e0', { exact: true }).fill('-2');
  await apply(page);
  await expect(feature(page).getByTestId('potts-frustration')).toHaveCount(0);
  await layout(page);
  expect(error).toEqual([]);
});

test('SW whole trajectories, cadence, segment isolation, q2 identity and independent hidden sessions', async ({
  page,
}) => {
  const error = errors(page);
  await open(page);
  await root(page)
    .getByLabel('Potts sampler', { exact: true })
    .selectOption('sw');
  await root(page).getByLabel('Potts warm-up trajectories').fill('1');
  await root(page)
    .getByLabel('Potts measurement stride (trajectories)')
    .fill('2');
  await apply(page);
  await step(page, 1);
  await expect(root(page).getByTestId('potts-samples')).toHaveText('0');
  await step(page, 2);
  await step(page, 3);
  await expect(root(page).getByTestId('potts-samples')).toHaveText('1');
  await show(page, 'transition');
  await expect(feature(page).getByTestId('fk-transition')).toContainText(
    'Swendsen–Wang whole trajectory',
  );
  await expect(feature(page)).toContainText('8 bond trials');
  const before = await feature(page).getByTestId('fk-transition').innerText();
  await page
    .getByRole('link', { name: 'Lattice Systems', exact: true })
    .click();
  await page
    .getByLabel('Lattice physical system', { exact: true })
    .selectOption('potts');
  await expect(button(page, 'Step')).toBeEnabled();
  await step(page, 1);
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await expect(updates(page)).toHaveText('3');
  expect(await feature(page).getByTestId('fk-transition').innerText()).toBe(
    before,
  );
  await root(page).getByLabel('Potts K e0', { exact: true }).fill('.9');
  await apply(page);
  await expect(root(page).getByTestId('potts-segment')).toHaveText('3');
  await expect(feature(page)).toContainText('No actual cluster trajectory');
  await root(page).getByLabel('Potts q', { exact: true }).selectOption('2');
  await apply(page);
  await expect(updates(page)).toHaveText('0');
  await show(page, 'ising');
  await expect(feature(page)).toContainText('J');
  await root(page)
    .getByLabel('Potts sampler', { exact: true })
    .selectOption('metropolis');
  await expect(root(page).getByLabel('Potts warm-up sweeps')).toBeVisible();
  await apply(page);
  await step(page, 1);
  await show(page, 'transition');
  await expect(feature(page)).toContainText('metropolis');
  await layout(page);
  expect(error).toEqual([]);
});

for (const [size, q, K] of [
  [8, 2, 0.7],
  [16, 3, Math.log(1 + Math.sqrt(3))],
  [32, 4, 1.6],
])
  test(`SW ${size}x${size} actual batch/render/pause, cluster view and bounded statistics`, async ({
    page,
  }, info) => {
    const error = errors(page);
    await page.goto('./#lattice-systems');
    await page
      .getByLabel('Lattice physical system', { exact: true })
      .selectOption('potts');
    await expect(button(page, 'Step')).toBeEnabled();
    await settings(page);
    await root(page)
      .getByLabel('Potts q', { exact: true })
      .selectOption(String(q));
    for (const axis of ['x', 'y']) {
      await root(page)
        .getByLabel(`Potts L${axis}`, { exact: true })
        .fill(String(size));
      await root(page)
        .getByLabel(`Potts K${axis}`, { exact: true })
        .fill(String(K));
    }
    await root(page)
      .getByLabel('Potts sampler', { exact: true })
      .selectOption('sw');
    await root(page).getByLabel('Potts warm-up trajectories').fill('0');
    await root(page)
      .getByLabel('Potts measurement stride (trajectories)')
      .fill('1');
    await apply(page);
    await show(page, 'fk-configuration');
    const start = Date.now();
    await button(page, 'Run').click();
    await expect
      .poll(async () => Number(await updates(page).innerText()))
      .toBeGreaterThan(0);
    await button(page, 'Pause').click();
    await expect(button(page, 'Step')).toBeEnabled();
    const elapsed = Date.now() - start;
    console.log(
      `M5d ${info.project.name} q${q} ${size}x${size} K${K} run/render/acknowledged-pause ${elapsed}ms`,
    );
    expect(elapsed).toBeLessThan(10000);
    await expect(feature(page).getByTestId('fk-current')).toContainText(
      'components',
    );
    await feature(page).getByLabel('Potts selected bond').selectOption('e6');
    await expect(feature(page).getByTestId('fk-bond')).toContainText(
      'occupied=',
    );
    const frozen = await updates(page).innerText();
    await feature(page).getByLabel('FK display').selectOption('colors');
    await show(page, 'fk-statistics');
    await expect(feature(page)).toContainText('Work including warm-up');
    await show(page, 'history');
    await feature(page)
      .getByLabel('Potts history observable')
      .selectOption('fk.clusters');
    await expect(feature(page).getByRole('img')).toHaveCount(1);
    await expect(updates(page)).toHaveText(frozen);
    await show(page, 'fk-configuration');
    await feature(page).getByLabel('FK display').selectOption('clusters');
    await layout(page);
    if (size === 32) {
      await root(page).getByText('Potts settings', { exact: true }).click();
      await page.screenshot({
        path: `docs/screenshots/m5d-lattice-${info.project.name}.png`,
        fullPage: true,
      });
    }
    expect(error).toEqual([]);
  });
