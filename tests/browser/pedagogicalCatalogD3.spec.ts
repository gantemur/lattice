import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const chooser = (page: Page) =>
  page.getByLabel('Named example', { exact: true });
const step = (page: Page) =>
  page.getByRole('button', { name: 'Step', exact: true });
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function choose(page: Page, id: string) {
  await chooser(page).selectOption(id);
  await expect(step(page)).toBeEnabled();
}

test('grouped examples are directly available and keyboard selectable', async ({
  page,
}, info) => {
  await page.goto('./#small-systems');
  await expect(chooser(page)).toBeEnabled();
  expect(
    await chooser(page)
      .locator('optgroup')
      .evaluateAll((groups) =>
        groups.map((group) => group.getAttribute('label')),
      ),
  ).toEqual([
    'Elementary probability',
    'Small Ising graphs',
    'Continuous small systems',
    'Advanced examples',
  ]);
  expect(await chooser(page).locator('option').count()).toBe(20);
  if (info.project.name !== 'mobile-webkit') {
    await chooser(page).focus();
    await expect(chooser(page)).toBeFocused();
    await chooser(page).press('ArrowDown');
    await expect(chooser(page)).toBeFocused();
    await expect(chooser(page)).toHaveValue('spin');
  }
  await choose(page, 'gaussian');
  expect(await noOverflow(page)).toBe(true);
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/pedagogical-catalog-d3-chooser-${info.project.name}.png`,
      fullPage: true,
    });
});

test('small Ising examples retain topology, exact panels and advanced access', async ({
  page,
}, info) => {
  await page.goto('./#small-systems');
  for (const [id, heading, edges] of [
    ['ising-dimer', 'Two-spin dimer', 1],
    ['ising-chain3', 'Three-spin open chain', 2],
    ['ising-triangle', 'Three-spin triangle', 3],
    ['ising-antiferro-triangle', 'Three-spin triangle', 3],
    ['ising', 'Periodic 1×4 chain', 4],
  ] as const) {
    await choose(page, id);
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator('.graph-edge')).toHaveCount(edges);
    await expect(page.getByTestId('small-exact-references')).toBeVisible();
    if (id === 'ising-antiferro-triangle') {
      await expect(page.locator('.graph-edge.negative-weight')).toHaveCount(3);
      await expect(page.getByTestId('example-description')).toContainText(
        'six spin configurations',
      );
    }
    expect(await noOverflow(page)).toBe(true);
    if (info.project.name !== 'mobile-webkit')
      await page.screenshot({
        path: `docs/screenshots/pedagogical-catalog-d3-${id}-${info.project.name}.png`,
        fullPage: true,
      });
  }
  await page
    .getByText('Geometry & numerical parameters', { exact: true })
    .click();
  await expect(page.getByLabel('Geometry preset')).toHaveValue('ring');
  await page.getByLabel('Geometry preset').selectOption('torus');
  await expect(page.locator('.graph-edge')).toHaveCount(8);
  await expect(
    page.getByText('4 sites · 8 bonds · 4 faces', { exact: true }),
  ).toBeVisible();
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/pedagogical-catalog-d3-advanced-torus-${info.project.name}.png`,
      fullPage: true,
    });
  await choose(page, 'ising-dimer');
  await page
    .getByText('Geometry & numerical parameters', { exact: true })
    .click();
  await expect(page.getByLabel('Geometry preset')).toHaveValue('dimer');
  await page.getByLabel('Coupling e0').fill('0.8');
  await page.getByRole('button', { name: 'Apply graph parameters' }).click();
  await expect(page.getByTestId('example-description')).toContainText(
    'modified',
  );
  await step(page).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('example-description')).toContainText(
    'modified',
  );
  await expect(page.getByLabel('Coupling e0')).toHaveValue('0.8');
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/pedagogical-catalog-d3-modified-${info.project.name}.png`,
      fullPage: true,
    });
});

test('ordinary and frustrated triangles share a topology and isolate segments', async ({
  page,
}) => {
  await page.goto('./#small-systems');
  await choose(page, 'ising-triangle');
  await step(page).click();
  const spins = await page.getByTestId('spin-configuration').textContent();
  await choose(page, 'ising-antiferro-triangle');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  await expect(page.getByTestId('spin-configuration')).toHaveText(spins!);
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await step(page).click();
  await expect(page.getByTestId('total-updates')).toHaveText('2');
  await page
    .getByText('Geometry & numerical parameters', { exact: true })
    .click();
  await page.getByLabel('Geometry preset').selectOption('triangle');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 3');
  await expect(page.getByTestId('total-updates')).toHaveText('2');
  await expect(page.getByTestId('example-description')).toContainText(
    'Three-spin triangle',
  );
  await expect(page.getByTestId('example-description')).not.toContainText(
    'Frustrated',
  );
  await choose(page, 'ising-chain3');
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 1');
});

test('scalar catalog keeps compatible sampler controls and all prior presets', async ({
  page,
}, info) => {
  await page.goto('./#small-systems');
  await choose(page, 'scalar');
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/pedagogical-catalog-d3-scalar-pair-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await expect(page.getByLabel('Sampling algorithm')).toHaveValue('direct');
  await page.getByLabel('Sampling algorithm').selectOption('heat-bath');
  await step(page).click();
  await expect(page.getByLabel('Sampling algorithm')).toHaveValue('heat-bath');
  await expect(page.locator('.algorithm-label').first()).toContainText(
    'Direct',
  );
  for (const id of [
    'scalar-double-well',
    'scalar-tilted-well',
    'scalar-four-quartic',
  ] as const) {
    await choose(page, id);
    await expect(page.getByLabel('Sampling algorithm')).toHaveValue(
      'metropolis',
    );
    await page.getByRole('button', { name: 'Apply settings' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (info.project.name !== 'mobile-webkit')
      await page.screenshot({
        path: `docs/screenshots/pedagogical-catalog-d3-${id}-${info.project.name}.png`,
        fullPage: true,
      });
  }
  await choose(page, 'scalar-four-gaussian');
  await expect(page.getByLabel('Sampling algorithm')).toHaveValue('direct');
  await choose(page, 'scalar-baseline');
  await expect(page.getByLabel('Sampling algorithm')).toHaveValue('direct');
  await choose(page, 'scalar');
  await expect(page.getByLabel('Sampling algorithm')).toHaveValue('direct');
  expect(await noOverflow(page)).toBe(true);
});
