import { expect, test } from '@playwright/test';

test('QM gallery fills a single desktop row, returns to two columns, and stops at six', async ({
  page,
}, testInfo) => {
  await page.goto('#lattice-qm');
  const deck = page.getByRole('region', { name: 'Lattice QM tools' });
  const cards = deck.getByTestId('teaching-tool');
  await expect(cards).toHaveCount(1);
  await expect(deck.getByText('1/6 tools')).toBeVisible();
  await expect(page.getByLabel('Add tool type')).toHaveCount(0);
  if (testInfo.project.name === 'desktop') {
    const [grid, card] = await Promise.all([
      deck.locator('.tool-grid').boundingBox(),
      cards.first().boundingBox(),
    ]);
    expect(grid && card && card.width >= grid.width - 2).toBeTruthy();
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-b-qm-one-card.png',
      fullPage: true,
    });
  }

  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(deck.getByLabel('Tool 2 type')).toHaveValue('gap');
  await expect(deck.getByText('2/6 tools')).toBeVisible();
  if (testInfo.project.name === 'desktop') {
    const [first, second] = await Promise.all([
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
    ]);
    expect(first && second && Math.abs(first.y - second.y) < 2).toBeTruthy();
    expect(
      first && second && second.x > first.x + first.width - 2,
    ).toBeTruthy();
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-b-qm-two-cards.png',
      fullPage: true,
    });
  } else {
    await expect(cards.nth(1)).toBeVisible(); // Add activates mobile detail.
    await page.getByRole('button', { name: 'Compact overview' }).click();
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toBeVisible();
    await expect(cards.nth(1)).toBeVisible();
    await page.getByRole('button', { name: 'Single detail' }).click();
  }
  for (let index = 2; index < 6; index++)
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(cards).toHaveCount(6);
  await expect(deck.getByText('6/6 tools')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add tool' })).toBeDisabled();
  for (let index = 0; index < 6; index++) {
    if (testInfo.project.name !== 'desktop')
      await page
        .getByLabel('Lattice QM tools detail tool')
        .selectOption(
          (await cards.first().getAttribute('data-assignment-key'))!,
        );
    await cards
      .first()
      .getByRole('button', { name: /: Remove$/ })
      .click();
  }
  await expect(cards).toHaveCount(0);
  await expect(deck.getByText(/No gallery tools are open/)).toBeVisible();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('0');
});

test('QM tool-local settings survive an exchange; notes and formula remain usable', async ({
  page,
}, testInfo) => {
  await page.goto('#lattice-qm');
  const deck = page.getByRole('region', { name: 'Lattice QM tools' });
  const stage = deck.getByTestId('featured-tool');
  const gallery = deck.getByTestId('teaching-tool');
  await stage.getByLabel('Oscillator path range').fill('5');
  await gallery
    .getByRole('button', { name: 'Euclidean two-point correlator: Feature' })
    .click();
  if (testInfo.project.name !== 'desktop')
    await page.getByLabel('Lattice QM tools detail tool').selectOption('0');
  await expect(gallery.getByLabel('Oscillator path range')).toHaveValue('5');
  await expect(stage.getByLabel('Oscillator path range')).toHaveCount(0);
  await gallery
    .getByRole('button', { name: 'Current periodic path: Feature' })
    .click();
  await expect(stage.getByLabel('Oscillator path range')).toHaveValue('5');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  await page
    .locator('#qm-laboratory')
    .getByText('Technical details & measurement coverage')
    .click();
  await expect(
    page
      .locator('#qm-laboratory .model-page-details')
      .first()
      .getByText(/segment 1 began at update/),
  ).toBeVisible();
  await page
    .locator('#qm-laboratory')
    .getByText('Technical details & measurement coverage')
    .click();
  await page
    .locator('#qm-laboratory')
    .getByText('Mathematics, exercises & suggested experiments')
    .click();
  const notes = page
    .locator('#qm-laboratory .model-page-details')
    .last()
    .getByText(/transfer-operator quadrature/);
  await expect(notes).toBeVisible();
  if (testInfo.project.name === 'desktop') {
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-b-qm-notes.png',
      fullPage: true,
    });
    const overflow = await page
      .locator('#qm-laboratory .model-card .math-display')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
  await page
    .locator('#qm-laboratory')
    .getByText('Mathematics, exercises & suggested experiments')
    .click();
  await expect(notes).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('Fields keeps visual settings with assignments and renders the featured heatmap', async ({
  page,
}, testInfo) => {
  await page.goto('#fields-paths');
  const deck = page.getByRole('region', { name: 'Lattice Fields tools' });
  const stage = deck.getByTestId('featured-tool');
  const gallery = deck.getByTestId('teaching-tool');
  await expect(stage.getByLabel('Field display limit')).toBeVisible();
  await expect(stage.getByLabel('Pair field site')).toHaveCount(0);
  await stage.getByLabel('Field display limit').fill('6');
  if (testInfo.project.name !== 'desktop')
    await page.getByLabel('Lattice Fields tools detail tool').selectOption('1');
  await gallery.getByLabel('Pair field site').fill('2');
  await gallery
    .getByRole('button', { name: 'Selected site and covariance: Feature' })
    .click();
  await expect(stage.getByLabel('Pair field site')).toHaveValue('2');
  if (testInfo.project.name !== 'desktop')
    await page.getByLabel('Lattice Fields tools detail tool').selectOption('0');
  await expect(gallery.getByLabel('Field display limit')).toHaveValue('6');
  await expect(gallery.getByLabel('Pair field site')).toHaveCount(0);

  await page.getByLabel('Field dimension').selectOption('rectangle');
  await page.getByLabel('Field width').fill('2');
  await page.getByLabel('Field height').fill('2');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await page
    .getByLabel('Lattice Fields tools featured tool')
    .selectOption('profile');
  await expect(
    stage.getByRole('heading', { name: 'Field heatmap' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  if (testInfo.project.name === 'desktop')
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-b-fields-heatmap.png',
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('production page screenshots cover both model pages at desktop and 360 px', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile-webkit') return;
  for (const [route, name] of [
    ['#lattice-qm', 'qm'],
    ['#fields-paths', 'fields'],
  ] as const) {
    await page.goto(route);
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-b-${name}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    ).toBe(true);
  }
});
