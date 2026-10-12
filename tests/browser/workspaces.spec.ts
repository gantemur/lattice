import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function detail(
  page: Page,
  workspace: 'Lattice QM' | 'Lattice Fields',
  key: number,
) {
  if (key === 0) return; // The featured stage is always visible.
  const selector = page.getByLabel(`${workspace} tools detail tool`);
  if (await selector.isVisible()) await selector.selectOption(String(key));
}

test('five routes keep their order, legacy field route, and independent sessions', async ({
  page,
}) => {
  await page.goto('#lattice-qm');
  const links = page
    .getByRole('navigation', { name: 'Workspaces' })
    .getByRole('link');
  await expect(links).toHaveText([
    'Small Systems',
    'Lattice Systems',
    'Lattice QM',
    'Lattice Fields',
    'Experiments',
  ]);
  await expect(
    page.getByRole('link', { name: 'Lattice QM', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Lattice QM tools' })
      .getByLabel('Tool 2 type'),
  ).toHaveValue('gap');
  await page.getByRole('link', { name: 'Lattice Fields', exact: true }).click();
  await expect(page).toHaveURL(/#fields-paths$/);
  await expect(page.getByTestId('field-samples')).toHaveText('0');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  await page.goBack();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  await expect(
    page
      .getByRole('region', { name: 'Lattice QM tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(2);
  await page.goForward();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  for (const [name, hash] of [
    ['Small Systems', '#small-systems'],
    ['Lattice Systems', '#lattice-systems'],
    ['Experiments', '#experiments'],
  ] as const) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('tool edits stay in presentation state across parameter changes', async ({
  page,
}) => {
  await page.goto('#lattice-qm');
  await expect(
    page
      .getByRole('region', { name: 'Lattice QM tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(1);
  await expect(page.getByTestId('oscillator-quadrature-quality')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await page
    .getByRole('region', { name: 'Lattice QM tools' })
    .getByLabel('Tool 2 type')
    .selectOption('transfer');
  await expect(page.getByTestId('oscillator-quadrature-quality')).toBeVisible();
  const phoneDetail = page.getByLabel('Lattice QM tools detail tool');
  if (await phoneDetail.isVisible()) {
    await phoneDetail.selectOption('1');
    await expect(page.getByTestId('oscillator-quadrature-quality')).toHaveCount(
      0,
    );
    await phoneDetail.selectOption('2');
    await expect(
      page.getByTestId('oscillator-quadrature-quality'),
    ).toBeVisible();
  }
  await page
    .getByRole('button', { name: 'Transfer operator and quadrature: Collapse' })
    .click();
  await expect(page.getByTestId('oscillator-quadrature-quality')).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: 'Transfer operator and quadrature: Open' })
    .click();
  await page
    .getByRole('button', { name: 'Transfer operator and quadrature: Expand' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Transfer operator and quadrature tool' }),
  ).toHaveClass(/tool-expanded/);
  await page
    .getByRole('button', {
      name: 'Transfer operator and quadrature: Move earlier',
    })
    .click();
  await page
    .getByRole('region', { name: 'Transfer operator and quadrature tool' })
    .getByLabel('Tool 1 type')
    .selectOption('history');
  await expect(
    page.getByRole('region', { name: 'Recent path-average history tool' }),
  ).toBeVisible();
  await page.getByLabel('Oscillator omega').fill('2');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(
    page.getByRole('region', { name: 'Recent path-average history tool' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Recent path-average history: Remove' })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Lattice QM tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Euclidean two-point correlator: Remove' })
    .click();
  await expect(
    page.getByText(/No gallery tools are open. Add tool/),
  ).toBeVisible();
});

test('display changes and navigation preserve a seeded QM path and running worker', async ({
  page,
}) => {
  await page.goto('#lattice-qm');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const first = await page
    .getByRole('img', { name: /Current periodic path/ })
    .locator('polyline')
    .getAttribute('points');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await page
    .getByRole('region', { name: 'Lattice QM tools' })
    .getByLabel('Tool 2 type')
    .selectOption('reflection');
  await detail(page, 'Lattice QM', 0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  expect(
    await page
      .getByRole('img', { name: /Current periodic path/ })
      .locator('polyline')
      .getAttribute('points'),
  ).toBe(first);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Lattice Fields', exact: true }).click();
  await expect(page).toHaveURL(/#fields-paths$/);
  await expect(page.getByTestId('field-samples')).toBeVisible();
  await page
    .locator('.workspace-surface:not([hidden])')
    .getByRole('link', { name: 'Lattice QM', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeVisible();
  // Pause can leave one posted batch in flight; wait for its acknowledgement.
  await expect(
    page.getByRole('button', { name: 'Run', exact: true }),
  ).toBeEnabled();
  const stopped = await page.getByTestId('oscillator-updates').textContent();
  await page.waitForTimeout(150);
  await expect(page.getByTestId('oscillator-updates')).toHaveText(stopped!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('field tools explain Fourier availability and phone overview stays within viewport', async ({
  page,
}, testInfo) => {
  await page.goto('#fields-paths');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await page
    .getByRole('region', { name: 'Lattice Fields tools' })
    .getByLabel('Tool 2 type')
    .selectOption('spectrum');
  await expect(
    page
      .getByText(/Full periodicity is required for these momentum eigenmodes/)
      .first(),
  ).toBeVisible();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Lattice Fields tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(6);
  await expect(
    page.getByRole('button', { name: 'Add tool', exact: true }),
  ).toBeDisabled();
  const overview = page.getByRole('button', { name: 'Compact overview' });
  if (await overview.isVisible()) {
    await overview.click();
    await expect(
      page.getByRole('button', { name: 'Single detail' }),
    ).toBeVisible();
    await page
      .getByRole('region', { name: 'Fourier spectrum tool' })
      .first()
      .getByRole('button', { name: 'View detail' })
      .click();
    await expect(
      page
        .getByText(/Full periodicity is required for these momentum eigenmodes/)
        .first(),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/m4c0-fields-${testInfo.project.name}.png`,
      fullPage: true,
    });
});

test('featured QM tool spans the main width and swaps without changing seeded paths', async ({
  page,
}, testInfo) => {
  await page.goto('#lattice-qm');
  const deck = page.getByRole('region', { name: 'Lattice QM tools' });
  const stage = deck.getByTestId('featured-tool');
  const gallery = deck.getByTestId('teaching-tool');
  await expect(
    stage.getByRole('heading', { name: 'Current periodic path', exact: true }),
  ).toBeVisible();
  await expect(gallery).toHaveCount(1);
  await expect(page.getByTestId('oscillator-quadrature-quality')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const first = await stage
    .getByRole('img', { name: /Current periodic path/ })
    .locator('polyline')
    .getAttribute('points');
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/featured-stage-a-qm-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await gallery
    .getByRole('button', { name: 'Euclidean two-point correlator: Feature' })
    .click();
  await expect(
    stage.getByRole('heading', {
      name: 'Euclidean two-point correlator',
      exact: true,
    }),
  ).toBeVisible();
  await expect(gallery).toHaveAttribute(
    'aria-label',
    'Current periodic path tool',
  );
  expect(await gallery.getAttribute('data-assignment-key')).toBe('0');
  await page.getByLabel('Lattice QM tools featured tool').selectOption('path');
  await expect(
    stage.getByRole('heading', { name: 'Current periodic path', exact: true }),
  ).toBeVisible();
  await expect(gallery).toHaveAttribute(
    'aria-label',
    'Current periodic path tool',
  );
  await expect(page.getByTestId('oscillator-samples')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  expect(
    await stage
      .getByRole('img', { name: /Current periodic path/ })
      .locator('polyline')
      .getAttribute('points'),
  ).toBe(first);
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
    await deck.getByLabel('Tool 2 type').selectOption('history');
    const [featureBox, firstCard, secondCard] = await Promise.all([
      stage.boundingBox(),
      gallery.nth(0).boundingBox(),
      gallery.nth(1).boundingBox(),
    ]);
    expect(featureBox!.width).toBeGreaterThan(firstCard!.width * 1.8);
    expect(secondCard!.x).toBeGreaterThan(firstCard!.x + 50);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('featured Fields tool retains Fourier mode through swaps and phone overview', async ({
  page,
}, testInfo) => {
  await page.goto('#fields-paths');
  await page
    .getByRole('button', { name: 'Draft massive periodic example' })
    .click();
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  const stage = page
    .getByRole('region', { name: 'Lattice Fields tools' })
    .getByTestId('featured-tool');
  await expect(
    stage.getByRole('heading', {
      name: 'Current field configuration',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Lattice Fields tools' })
      .getByLabel('Tool 2 type'),
  ).toHaveValue('spectrum');
  await page.getByLabel('Fourier momentum index').fill('3');
  const spectrumCard = page.getByRole('region', {
    name: 'Fourier spectrum tool',
  });
  const spectrumKey = await spectrumCard.getAttribute('data-assignment-key');
  await spectrumCard
    .getByRole('button', { name: 'Fourier spectrum: Feature' })
    .click();
  await expect(stage.getByLabel('Fourier momentum index')).toHaveValue('3');
  await expect(
    page.getByRole('heading', { name: 'Finite-volume Fourier spectrum' }),
  ).toHaveCount(1);
  await page
    .getByRole('region', { name: 'Current field configuration tool' })
    .getByRole('button', { name: 'Current field configuration: Feature' })
    .click();
  expect(
    await page
      .getByRole('region', { name: 'Fourier spectrum tool' })
      .getAttribute('data-assignment-key'),
  ).toBe(spectrumKey);
  await detail(page, 'Lattice Fields', Number(spectrumKey));
  await expect(page.getByLabel('Fourier momentum index')).toHaveValue('3');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('field-samples')).toHaveText('1');
  const overview = page.getByRole('button', { name: 'Compact overview' });
  if (await overview.isVisible()) {
    await overview.click();
    await expect(page.getByLabel('Fourier momentum index')).toHaveCount(0);
    await page.getByRole('button', { name: 'Single detail' }).click();
    await expect(page.getByLabel('Fourier momentum index')).toHaveValue('3');
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/featured-stage-a-fields-${testInfo.project.name}.png`,
      fullPage: true,
    });
});
