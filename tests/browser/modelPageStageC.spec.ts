import { expect, test } from '@playwright/test';

async function open(page: import('@playwright/test').Page) {
  await page.goto('#lattice-systems');
  await expect(page.getByTestId('lattice-canvas')).toBeVisible();
  return page.getByRole('region', { name: 'Lattice Systems tools' });
}

async function runUntil(
  page: import('@playwright/test').Page,
  updates: number,
) {
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('lattice-updates').textContent()),
    )
    .toBeGreaterThan(updates);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
}

test('32×32 canvas is the sole default feature; selection and latest-update marks are display-only', async ({
  page,
}, testInfo) => {
  const deck = await open(page);
  const stage = deck.getByTestId('featured-tool');
  const cards = deck.getByTestId('teaching-tool');
  await expect(
    stage.getByRole('heading', { name: 'Spin configuration' }),
  ).toBeVisible();
  await expect(stage.getByText('32×32 · 1024 sites')).toBeVisible();
  await expect(cards).toHaveCount(2);
  await expect(deck.getByLabel('Tool 1 type')).toHaveValue('m-history');
  await expect(deck.getByLabel('Tool 2 type')).toHaveValue('e-history');
  if (testInfo.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-c-default-${testInfo.project.name}.png`,
      fullPage: true,
    });
  const canvas = stage.getByTestId('lattice-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThan(
    testInfo.project.name === 'desktop' ? 500 : 250,
  );
  await canvas.click({
    position: { x: bounds!.width * 0.74, y: bounds!.height * 0.26 },
  });
  await expect(stage.getByLabel('Inspect x')).toHaveValue('23');
  await expect(stage.getByLabel('Inspect y')).toHaveValue('8');
  await expect(page.getByTestId('lattice-updates')).toHaveText('0');
  await stage.getByLabel('Inspect x').fill('7');
  await stage.getByLabel('Inspect y').fill('9');
  await expect(stage.locator('.lattice-detail')).toHaveCount(0);
  const selectedOutline = await canvas.evaluate((element) => {
    const image = element as HTMLCanvasElement;
    return Array.from(
      image.getContext('2d')!.getImageData(7 * 20 + 10, 9 * 20 + 1, 1, 1).data,
    ).slice(0, 3);
  });
  expect(selectedOutline).toEqual([21, 46, 42]);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  await expect(page.getByTestId('lattice-trace')).toContainText('Update 1');
  const trace = await page.getByTestId('lattice-trace').textContent();
  const [, updatedX, updatedY] = trace!.match(/at \((\d+),(\d+)\)/)!;
  const latestOutline = await canvas.evaluate(
    (element, coordinates) => {
      const image = element as HTMLCanvasElement;
      return Array.from(
        image
          .getContext('2d')!
          .getImageData(coordinates.x * 20 + 10, coordinates.y * 20 + 1, 1, 1)
          .data,
      ).slice(0, 3);
    },
    { x: Number(updatedX), y: Number(updatedY) },
  );
  expect(latestOutline).toEqual([245, 206, 102]);
  await expect(stage.getByText('latest updated site')).toBeVisible();
  expect(await deck.getByTestId('lattice-canvas').count()).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  if (testInfo.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-c-inspection-${testInfo.project.name}.png`,
      fullPage: true,
    });
});

test('all 16 plots remain selectable; feature exchange keeps one canvas and six-card cap', async ({
  page,
}, testInfo) => {
  const deck = await open(page);
  const choices = await deck
    .getByLabel('Tool 1 type')
    .locator('option')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value),
    );
  expect(choices).toEqual([
    'spin-configuration',
    'local-neighborhood',
    'm-history',
    'abs-history',
    'e-history',
    'm-histogram',
    'e-histogram',
    'm-mean',
    'abs-mean',
    'e-mean',
    'acceptance',
    'm-acf',
    'abs-acf',
    'e-acf',
    'm-blocking',
    'e-blocking',
    'spatial-x',
    'spatial-y',
  ]);
  if (testInfo.project.name === 'desktop') {
    const [first, second] = await Promise.all([
      deck.getByTestId('teaching-tool').first().boundingBox(),
      deck.getByTestId('teaching-tool').last().boundingBox(),
    ]);
    expect(first && second && Math.abs(first.y - second.y) < 2).toBeTruthy();
  }
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('2');
  await deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('button', { name: 'Energy density history: Remove' })
    .click();
  if (testInfo.project.name === 'desktop') {
    const [grid, card] = await Promise.all([
      deck.locator('.tool-grid').boundingBox(),
      deck.getByTestId('teaching-tool').first().boundingBox(),
    ]);
    expect(grid && card && card.width >= grid.width - 2).toBeTruthy();
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-c-one-card.png',
      fullPage: true,
    });
  }
  await deck.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(deck.getByLabel('Tool 2 type')).toHaveValue(
    'local-neighborhood',
  );
  await deck.getByTestId('featured-tool').getByLabel('Inspect x').fill('11');
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('1');
  await deck
    .getByTestId('teaching-tool')
    .first()
    .getByRole('button', { name: 'Magnetization history: Feature' })
    .click();
  if (testInfo.project.name !== 'desktop')
    await page
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('0');
  await expect(
    deck
      .getByTestId('featured-tool')
      .getByRole('heading', { name: 'Magnetization history' }),
  ).toBeVisible();
  await expect(
    deck.getByTestId('teaching-tool').first().getByLabel('Inspect x'),
  ).toHaveValue('11');
  await expect(deck.getByTestId('lattice-canvas')).toHaveCount(1);
  await deck
    .getByTestId('teaching-tool')
    .first()
    .getByRole('button', { name: 'Spin configuration: Feature' })
    .click();
  await expect(
    deck.getByTestId('featured-tool').getByLabel('Inspect x'),
  ).toHaveValue('11');
  await expect(deck.getByTestId('lattice-canvas')).toHaveCount(1);
  for (let count = 2; count < 6; count++)
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(deck.getByTestId('teaching-tool')).toHaveCount(6);
  await expect(
    page.getByRole('button', { name: 'Add tool', exact: true }),
  ).toBeDisabled();
  await deck.getByLabel('Tool 6 type').selectOption('spatial-x');
  if (testInfo.project.name !== 'desktop')
    await page
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption(
        (await deck
          .getByTestId('teaching-tool')
          .last()
          .getAttribute('data-assignment-key'))!,
      );
  await expect(deck.getByLabel('Spatial maximum displacement')).toBeVisible();
  await deck.getByLabel('Spatial maximum displacement').selectOption('3');
  await deck
    .getByTestId('teaching-tool')
    .last()
    .getByRole('button', { name: 'Spatial correlation · x: Feature' })
    .click();
  await expect(
    deck
      .getByTestId('featured-tool')
      .getByLabel('Spatial maximum displacement'),
  ).toHaveValue('3');
  await expect(page.getByTestId('lattice-updates')).toHaveText('0');
  if (testInfo.project.name === 'desktop') {
    await deck.getByLabel('Tool 4 type').selectOption('m-acf');
    await deck.getByLabel('Tool 5 type').selectOption('acceptance');
    await runUntil(page, 25000);
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-c-six-cards.png',
      fullPage: true,
    });
  }
});

test('shared sweep window, contextual spatial controls, and segment-local histories', async ({
  page,
}, testInfo) => {
  const deck = await open(page);
  await page.getByLabel('Size preset').selectOption('2');
  await page.getByLabel('Warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await runUntil(page, 500);
  await expect(
    page.getByRole('checkbox', { name: 'Follow latest' }),
  ).toBeVisible();
  await deck.getByLabel('Measurement window').selectOption('500');
  await page.getByRole('checkbox', { name: 'Follow latest' }).uncheck();
  const earliest = Number(
    (await deck
      .getByText(/Earliest retained sweep/)
      .first()
      .textContent())!.match(/Earliest retained sweep (\d+)/)![1],
  );
  const end = earliest + 50;
  await deck.getByLabel('End sweep').fill(String(end));
  await expect(
    deck.getByRole('img', {
      name: `Magnetization history, sweeps ${Math.max(0, end - 500)}–${end}`,
    }),
  ).toBeVisible();
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('2');
  await expect(
    deck.getByRole('img', {
      name: `Energy density history, sweeps ${Math.max(0, end - 500)}–${end}`,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Newer' }).click();
  await expect(deck.getByLabel('End sweep')).not.toHaveValue(String(end));
  await page.getByRole('checkbox', { name: 'Follow latest' }).check();
  const oldUpdates = await page.getByTestId('lattice-updates').textContent();
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('1');
  await deck.getByLabel('Tool 1 type').selectOption('m-histogram');
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('2');
  await deck.getByLabel('Tool 2 type').selectOption('e-histogram');
  await expect(
    page.getByRole('checkbox', { name: 'Follow latest' }),
  ).toHaveCount(0);
  await deck.getByLabel('Tool 2 type').selectOption('spatial-x');
  if (testInfo.project.name !== 'desktop')
    await page
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('2');
  await expect(deck.getByLabel('Spatial maximum displacement')).toBeVisible();
  await expect(
    deck.getByRole('img', { name: /^Connected x-axis pair correlation/ }),
  ).toBeVisible();
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('1');
  await deck.getByLabel('Tool 1 type').selectOption('m-history');
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('2');
  await deck.getByLabel('Tool 2 type').selectOption('e-history');
  await page.getByLabel('Temperature T').fill('4');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('lattice-updates')).toHaveText(oldUpdates!);
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Step', exact: true }).click();
  if (testInfo.project.name !== 'desktop')
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('1');
  await deck.getByLabel('Measurement window').selectOption('1000');
  const newSweep =
    Number(await page.getByTestId('lattice-updates').textContent()) / 4;
  await deck.getByRole('checkbox', { name: 'Follow latest' }).uncheck();
  await deck.getByLabel('End sweep').fill(String(newSweep));
  await expect(
    deck
      .getByRole('img', { name: /Magnetization history/ })
      .locator('polyline'),
  ).toHaveCount(2);
  expect(Number(oldUpdates)).toBeGreaterThan(500);
});

test('tool edits do not consume the seeded stream; exact details, notes and 64×64 remain usable', async ({
  page,
  context,
}, testInfo) => {
  const control = await context.newPage();
  const deck = await open(page);
  await open(control);
  for (const browserPage of [page, control]) {
    await browserPage.getByLabel('Size preset').selectOption('2');
    await browserPage.getByRole('button', { name: 'Apply settings' }).click();
    await browserPage
      .getByRole('button', { name: 'Step', exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await deck.getByLabel('Tool 3 type').selectOption('m-acf');
  if (testInfo.project.name !== 'desktop') {
    await deck.getByRole('button', { name: 'Compact overview' }).click();
    await deck.getByRole('button', { name: 'Single detail' }).click();
    await deck
      .getByLabel('Lattice Systems tools detail tool')
      .selectOption('1');
  }
  await deck.getByLabel('Measurement window').selectOption('1000');
  await deck.getByTestId('featured-tool').getByLabel('Inspect x').fill('1');
  for (let i = 0; i < 5; i++) {
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
  await page.locator('.lattice-technical-details > summary').click();
  await expect(page.getByTestId('lattice-exact')).toContainText(
    '8 distinct bonds',
  );
  await expect(
    page.getByTestId('lattice-equilibrium-observables'),
  ).toBeVisible();
  await page.locator('.lattice-teaching-notes > summary').click();
  await expect(page.getByText(/finite box has no singularity/)).toBeVisible();
  if (testInfo.project.name === 'desktop')
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-c-exact-notes.png',
      fullPage: true,
    });
  await page.getByLabel('Size preset').selectOption('64');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-canvas')).toHaveAttribute(
    'width',
    '640',
  );
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('lattice-updates')).toHaveText('1');
  if (testInfo.project.name === 'desktop')
    await page.screenshot({
      path: 'docs/screenshots/model-page-stage-c-64x64.png',
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});
