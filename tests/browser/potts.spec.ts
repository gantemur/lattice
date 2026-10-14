import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 90000 });
const root = (p: Page) => p.locator('.potts-workspace:visible');
const feature = (p: Page) => root(p).getByTestId('featured-tool');
const updates = (p: Page) => root(p).getByTestId('potts-updates');
const button = (p: Page, name: string) =>
  root(p).getByRole('button', { name, exact: true });
async function settings(p: Page) {
  if (!(await root(p).getByLabel('Potts q', { exact: true }).isVisible()))
    await root(p).getByText('Potts settings', { exact: true }).click();
}
async function open(p: Page, example = 'potts-dimer') {
  await p.goto('./#small-systems');
  await p.getByLabel('Named example', { exact: true }).selectOption(example);
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
async function step(p: Page, count: number) {
  await button(p, 'Step').click();
  await expect(updates(p)).toHaveText(String(count));
}
async function layout(p: Page) {
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
}
async function lattice(p: Page) {
  await p.getByRole('link', { name: 'Lattice Systems', exact: true }).click();
  await p
    .getByLabel('Lattice physical system', { exact: true })
    .selectOption('potts');
  await expect(p.getByTestId('lattice-potts-workspace')).toBeVisible();
  await expect(button(p, 'Step')).toBeEnabled();
  await settings(p);
}

test('Potts named examples, exact normalization, signed drafts and eight physical torus bonds', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await open(page, 'potts-torus');
  await expect(
    page.getByLabel('Named example', { exact: true }).locator('option'),
  ).toHaveCount(27);
  await expect(feature(page)).toContainText(
    '8 physical bonds · 4 oriented faces',
  );
  await feature(page).getByLabel('Potts selected bond').selectOption('e6');
  await feature(page).getByLabel('Potts selected site').fill('3');
  await show(page, 'conditional');
  await expect(feature(page).getByTestId('potts-bond')).toContainText(
    'Bond e6:',
  );
  await expect(feature(page).getByRole('table')).toContainText(
    'Exact marginal',
  );
  await root(page).getByLabel('Potts K e6', { exact: true }).fill('-1.2');
  await expect(root(page).getByTestId('potts-applied')).toContainText('e6=0.7');
  await apply(page);
  await expect(root(page).getByTestId('potts-applied')).toContainText(
    'e6=-1.2',
  );
  await expect(root(page).getByTestId('potts-segment')).toHaveText('2');
  await root(page).getByLabel('Potts K e6', { exact: true }).fill('5');
  await button(page, 'Apply Potts settings').click();
  expect(
    await root(page)
      .getByLabel('Potts K e6', { exact: true })
      .evaluate((e: HTMLInputElement) => e.validity.rangeOverflow),
  ).toBe(true);
  await root(page).getByLabel('Potts K e6', { exact: true }).fill('-1.2');
  for (const [q, count] of [
    [2, 16],
    [3, 81],
    [4, 256],
  ]) {
    await root(page)
      .getByLabel('Potts q', { exact: true })
      .selectOption(String(q));
    await apply(page);
    await expect(updates(page)).toHaveText('0');
    await show(page, 'reference');
    await expect(feature(page).getByTestId('potts-exact')).toContainText(
      `${count} configurations`,
    );
    await expect(feature(page).getByTestId('potts-exact')).toContainText(
      'probability sum=1',
    );
    await step(page, 1);
    await expect(root(page).getByTestId('potts-samples')).toHaveText('1');
    await show(page, 'ising');
    await expect(feature(page)).toContainText('physical bonds');
  }
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('potts-triangle');
  await expect(updates(page)).toHaveText('0');
  await show(page, 'reference');
  await expect(feature(page).getByTestId('potts-frustration')).toContainText(
    '6 ground configurations and 0 agreeing',
  );
  await show(page, 'configuration');
  await layout(page);
  await step(page, 1);
  if (info.project.name !== 'desktop')
    await root(page).getByText('Potts settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5c-small-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('potts-dimer');
  await show(page, 'configuration');
  await expect(feature(page)).toContainText(
    '2 categorical sites · 1 physical bonds',
  );
  await settings(page);
  await root(page).getByLabel('Potts graph geometry').selectOption('site');
  await apply(page);
  await expect(feature(page)).toContainText('No bonds');
  expect(errors).toEqual([]);
});

test('Potts display-only replay, local sampler segments and bounded tool gallery', async ({
  page,
}) => {
  await open(page);
  await step(page, 1);
  await show(page, 'transition');
  const trace = await feature(page)
    .getByTestId('potts-transition')
    .textContent();
  await expect(feature(page)).toContainText(
    'Acceptance N/A: exact independent',
  );
  await button(page, 'Reset').click();
  await expect(updates(page)).toHaveText('0');
  for (const id of [
    'conditional',
    'reference',
    'occupation',
    'measurements',
    'history',
    'correlation',
    'ising',
    'configuration',
  ])
    await show(page, id);
  await root(page)
    .getByRole('button', { name: 'Color occupation: Feature', exact: true })
    .click();
  await expect(root(page).getByLabel('Potts tools featured tool')).toHaveValue(
    'occupation',
  );
  for (let i = 0; i < 4; i++) await button(page, 'Add tool').click();
  await expect(button(page, 'Add tool')).toBeDisabled();
  await step(page, 1);
  await show(page, 'transition');
  await expect(feature(page).getByTestId('potts-transition')).toHaveText(
    trace!,
  );
  for (const sampler of ['metropolis', 'heat-bath']) {
    await root(page)
      .getByLabel('Potts sampler', { exact: true })
      .selectOption(sampler);
    await root(page).getByLabel('Potts warm-up sweeps').fill('0');
    await apply(page);
    const before = Number(await updates(page).textContent());
    await step(page, before + 1);
    await expect(feature(page)).toContainText(`${sampler}:`);
    await expect(feature(page)).toContainText(
      `Uniforms (${sampler === 'metropolis' ? 3 : 2})`,
    );
    await button(page, 'Run').click();
    await expect
      .poll(async () => Number(await updates(page).textContent()))
      .toBeGreaterThan(before + 128);
    await button(page, 'Pause').click();
    await expect(button(page, 'Step')).toBeEnabled();
  }
  await expect(feature(page)).toContainText('Acceptance N/A: heat bath');
  await expect(root(page).getByTestId('potts-segment')).toHaveText('3');
  await show(page, 'measurements');
  await expect(
    feature(page)
      .getByRole('table', { name: 'Potts segment measurements' })
      .locator('tbody tr'),
  ).toHaveCount(3);
  await show(page, 'history');
  await expect(feature(page).locator('svg')).toHaveCount(3);
  const overview = button(page, 'Compact overview');
  if (await overview.isVisible()) await overview.click();
  await layout(page);
});

test('Potts independent mounted sessions, lattice boundaries, exact tools and Ising return', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await step(page, 1);
  await lattice(page);
  await root(page).getByLabel('Potts Lx', { exact: true }).fill('2');
  await root(page).getByLabel('Potts Ly', { exact: true }).fill('2');
  await root(page).getByLabel('Potts Kx', { exact: true }).fill('-1.2');
  await root(page).getByLabel('Potts Ky', { exact: true }).fill('0.8');
  await root(page).getByLabel('Potts y boundary').selectOption('open');
  await root(page)
    .getByLabel('Potts sampler', { exact: true })
    .selectOption('direct');
  await apply(page);
  await expect(feature(page)).toContainText(
    '4 categorical sites · 6 physical bonds',
  );
  await step(page, 1);
  await show(page, 'reference');
  await expect(feature(page).getByTestId('potts-exact')).toContainText(
    '81 configurations',
  );
  await show(page, 'correlation');
  await expect(feature(page)).toContainText('not connected');
  await show(page, 'configuration');
  await feature(page).getByLabel('Potts selected site').fill('3');
  await expect(feature(page).getByTestId('potts-selected')).toContainText(
    'Site 3',
  );
  if (info.project.name !== 'desktop')
    await root(page).getByText('Potts settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5c-lattice-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await expect(page.getByTestId('small-potts-workspace')).toBeVisible();
  await expect(updates(page)).toHaveText('1');
  await step(page, 2);
  await page
    .getByRole('link', { name: 'Lattice Systems', exact: true })
    .click();
  await expect(page.getByTestId('lattice-potts-workspace')).toBeVisible();
  await expect(updates(page)).toHaveText('1');
  await root(page)
    .getByLabel('Lattice physical system', { exact: true })
    .selectOption('2d');
  await expect(
    page.getByLabel('Lattice physical system', { exact: true }),
  ).toHaveValue('2d');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page
    .getByLabel('Lattice physical system', { exact: true })
    .selectOption('potts');
  await expect(updates(page)).toHaveText('1');
  await layout(page);
  expect(errors).toEqual([]);
});

for (const q of [2, 3, 4])
  test(`Potts q=${q} 32×32 local samplers acknowledge Pause responsively`, async ({
    page,
  }, info) => {
    await page.goto('./#lattice-systems');
    await page
      .getByLabel('Lattice physical system', { exact: true })
      .selectOption('potts');
    await expect(button(page, 'Step')).toBeEnabled();
    await settings(page);
    await root(page)
      .getByLabel('Potts q', { exact: true })
      .selectOption(String(q));
    await root(page).getByLabel('Potts Lx', { exact: true }).fill('32');
    await root(page).getByLabel('Potts Ly', { exact: true }).fill('32');
    await root(page).getByLabel('Potts warm-up sweeps').fill('0');
    for (const sampler of ['metropolis', 'heat-bath']) {
      await root(page)
        .getByLabel('Potts sampler', { exact: true })
        .selectOption(sampler);
      await apply(page);
      const before = Number(await updates(page).textContent()),
        start = Date.now();
      await button(page, 'Run').click();
      await expect
        .poll(async () => Number(await updates(page).textContent()))
        .toBeGreaterThan(before);
      await button(page, 'Pause').click();
      await expect(button(page, 'Step')).toBeEnabled();
      const elapsed = Date.now() - start;
      console.info(
        `M5c ${info.project.name} q=${q} 32x32 ${sampler} run/render/acknowledged-pause ${elapsed}ms`,
      );
      expect(elapsed).toBeLessThan(10000);
      expect(
        Number(await root(page).getByTestId('potts-samples').textContent()),
      ).toBeGreaterThan(0);
    }
    await layout(page);
  });
