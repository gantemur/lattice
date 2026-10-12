import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('#lattice-systems');
  await expect(page.getByTestId('lattice-canvas')).toBeVisible();
  return page.getByRole('region', { name: 'Lattice Systems tools' });
}

test('neighborhood is a selectable, exchangeable display on desktop and phone', async ({
  page,
}, testInfo) => {
  const deck = await open(page);
  const featured = deck.getByTestId('featured-tool');
  await expect(featured.getByTestId('lattice-canvas')).toBeVisible();
  await expect(featured.locator('.lattice-detail')).toHaveCount(0);
  await expect(deck.getByTestId('teaching-tool')).toHaveCount(2);
  await expect(deck.getByLabel('Tool 1 type')).toHaveValue('m-history');
  await expect(deck.getByLabel('Tool 2 type')).toHaveValue('e-history');
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/ising-neighborhood-default-${testInfo.project.name}.png`,
      fullPage: true,
    });

  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('2');
  await deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('button', { name: 'Energy density history: Remove' })
    .click();
  await deck.getByRole('button', { name: 'Add tool' }).click();
  await expect(deck.getByLabel('Tool 2 type')).toHaveValue(
    'local-neighborhood',
  );
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('3');
  const neighborhood = deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('region', { name: 'Local 5×5 neighborhood' });
  await expect(neighborhood.getByTestId('neighborhood-cell')).toHaveCount(25);
  await expect(neighborhood.locator('[data-center="true"]')).toHaveAttribute(
    'data-site',
    '0',
  );
  const canvas = featured.getByTestId('lattice-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await canvas.click({
    position: { x: bounds!.width * 0.25, y: bounds!.height * 0.5 },
  });
  await expect(neighborhood.getByLabel('Inspect x')).toHaveValue('8');
  await expect(neighborhood.getByLabel('Inspect y')).toHaveValue('16');
  await neighborhood.getByLabel('Inspect x').fill('7');
  await neighborhood.getByLabel('Inspect y').fill('9');
  await expect(featured.getByLabel('Inspect x')).toHaveValue('7');
  await expect(featured.getByLabel('Inspect y')).toHaveValue('9');
  await expect(neighborhood.locator('[data-center="true"]')).toHaveAttribute(
    'data-site',
    String(7 + 32 * 9),
  );
  await expect(page.getByTestId('lattice-updates')).toHaveText('0');
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/ising-neighborhood-gallery-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('button', { name: 'Local 5×5 neighborhood: Collapse' })
    .click();
  await deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('button', { name: 'Local 5×5 neighborhood: Open' })
    .click();
  await expect(neighborhood.getByLabel('Inspect x')).toHaveValue('7');
  await deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('button', { name: 'Local 5×5 neighborhood: Feature' })
    .click();
  await expect(featured.getByLabel('Inspect x')).toHaveValue('7');
  await expect(featured.getByTestId('neighborhood-cell')).toHaveCount(25);
  await expect(deck.getByTestId('lattice-canvas')).toHaveCount(1);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/ising-neighborhood-featured-${testInfo.project.name}.png`,
      fullPage: true,
    });
  if (testInfo.project.name !== 'desktop') {
    await deck.getByRole('button', { name: 'Compact overview' }).click();
    await expect(deck.getByTestId('teaching-tool')).toHaveCount(2);
    await deck.getByRole('button', { name: 'Single detail' }).click();
  }
  await page.getByRole('link', { name: 'Small Systems' }).click();
  await page.getByRole('link', { name: 'Lattice Systems' }).click();
  await expect(featured.getByLabel('Inspect x')).toHaveValue('7');
  await page.getByLabel('Temperature T').fill('4');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await expect(featured.getByLabel('Inspect x')).toHaveValue('7');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('open corners and periodic 2×2 images use true physical coordinates', async ({
  page,
}, testInfo) => {
  const deck = await open(page);
  await deck
    .getByLabel('Lattice Systems tools featured tool')
    .selectOption('local-neighborhood');
  const view = deck.getByTestId('featured-tool');
  await page.getByRole('checkbox', { name: 'Periodic x' }).uncheck();
  await page.getByRole('checkbox', { name: 'Periodic y' }).uncheck();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  // Geometry starts a new seeded session, whose ToolDeck restores its default.
  await deck
    .getByLabel('Lattice Systems tools featured tool')
    .selectOption('local-neighborhood');
  await expect(view.locator('[data-center="true"]')).toHaveAttribute(
    'data-site',
    '0',
  );
  await expect(view.getByTestId('neighborhood-cell').first()).toHaveAttribute(
    'data-site',
    'outside',
  );
  await expect(view.locator('[data-site="outside"]')).toHaveCount(16);
  if (testInfo.project.name === 'desktop')
    await page.screenshot({
      path: 'docs/screenshots/ising-neighborhood-open-corner-desktop.png',
      fullPage: true,
    });
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByRole('checkbox', { name: 'Periodic x' }).check();
  await page.getByRole('checkbox', { name: 'Periodic y' }).check();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await deck
    .getByLabel('Lattice Systems tools featured tool')
    .selectOption('local-neighborhood');
  await view.getByLabel('Inspect x').fill('1');
  await view.getByLabel('Inspect y').fill('1');
  await expect(view.locator('[data-center="true"]')).toHaveAttribute(
    'data-site',
    '3',
  );
  await expect(view.locator('[data-site="3"]')).toHaveCount(9);
  await expect(view.locator('[data-site="outside"]')).toHaveCount(0);
  if (testInfo.project.name === 'desktop')
    await page.screenshot({
      path: 'docs/screenshots/ising-neighborhood-periodic-desktop.png',
      fullPage: true,
    });
});

test('neighborhood assignment and site selection leave seeded scientific state unchanged', async ({
  page,
  context,
}) => {
  const control = await context.newPage();
  const deck = await open(page);
  await open(control);
  for (const browserPage of [page, control]) {
    await browserPage.getByLabel('Size preset').selectOption('2');
    await browserPage.getByRole('button', { name: 'Apply settings' }).click();
  }
  await deck
    .getByLabel('Lattice Systems tools featured tool')
    .selectOption('local-neighborhood');
  await deck.getByTestId('featured-tool').getByLabel('Inspect x').fill('1');
  await deck.getByRole('button', { name: 'Add tool' }).click();
  await deck.getByLabel('Tool 3 type').selectOption('local-neighborhood');
  for (let update = 0; update < 20; update++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await control.getByRole('button', { name: 'Step', exact: true }).click();
  }
  for (const id of [
    'lattice-updates',
    'lattice-m',
    'lattice-e',
    'lattice-trace',
  ])
    expect(await page.getByTestId(id).textContent()).toBe(
      await control.getByTestId(id).textContent(),
    );
  await control.close();
});

test('saved scientific captures agree after display-only neighborhood changes', async ({
  page,
}) => {
  const deck = await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await deck
    .getByLabel('Lattice Systems tools featured tool')
    .selectOption('local-neighborhood');
  await deck.getByTestId('featured-tool').getByLabel('Inspect x').fill('1');
  await deck.getByRole('button', { name: 'Add tool' }).click();
  await deck.getByLabel('Tool 3 type').selectOption('spin-configuration');
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await page.goto('./#experiments');
  const choices = page.getByRole('checkbox', { name: /^Select / });
  await expect(choices).toHaveCount(2);
  await choices.nth(0).check();
  await choices.nth(1).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download selected JSON bundle' }).click(),
  ]);
  const bundle = JSON.parse(await readFile((await download.path())!, 'utf8'));
  const captures = bundle.records.map(
    (record: { scientific: { capture: unknown } }) => record.scientific.capture,
  ) as Array<Record<string, unknown>>;
  expect(captures).toHaveLength(2);
  const [before, after] = captures;
  for (const field of [
    'segment',
    'diagnosticRecord',
    'currentState',
    'seed',
    'captureUpdate',
  ])
    expect(after![field]).toEqual(before![field]);
});
