import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function selectDetail(page: Page, key: number) {
  const selector = page.getByLabel('Quartic QM tools detail tool');
  if (await selector.isVisible()) await selector.selectOption(String(key));
}

async function addTool(page: Page, tool: string) {
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  const cards = page
    .getByRole('region', { name: 'Quartic QM tools' })
    .getByTestId('teaching-tool');
  await cards
    .last()
    .getByLabel(`Tool ${await cards.count()} type`)
    .selectOption(tool);
  await selectDetail(
    page,
    Number(await cards.last().getAttribute('data-assignment-key')),
  );
}

test('quartic model, segments, transfer analysis and phone layout', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('#lattice-qm');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await expect(
    page.getByRole('heading', { name: 'Current periodic path x(t)' }),
  ).toBeVisible();
  await expect(page.getByText(/constant path mode fluctuates/)).toBeVisible();
  await page.getByLabel('Quartic warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('quartic-samples').textContent()),
    )
    .toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await page.getByTestId('quartic-updates').textContent();
  await page.getByLabel('Quartic path range').fill('2');
  await expect(page.getByTestId('quartic-updates')).toHaveText(before!);
  await page.getByLabel('Quartic h').fill('0.4');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(
    page.locator(
      '.workspace-surface:not([hidden]) .field-run-panel .run-notice',
    ),
  ).toContainText('isolated segment');
  await expect(page.getByTestId('quartic-samples')).toHaveText('0');
  await selectDetail(page, 1);
  await expect(page.getByText(/Segment 2: β=8, r=-2, λ=1, h=0/)).toBeVisible();
  await addTool(page, 'transfer');
  await expect(page.getByTestId('quartic-transfer-status')).toContainText(
    'resolved',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('quartic-updates').textContent()),
    )
    .toBeGreaterThan(Number(before));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await addTool(page, 'history');
  await addTool(page, 'effective');
  await addTool(page, 'transition');
  await expect(
    page
      .getByRole('region', { name: 'Quartic QM tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(6);
  await selectDetail(page, 3);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/m4c1-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('quartic-updates')).toHaveText('0');
});

test('tool exchanges and display range leave the quartic seeded stream unchanged', async ({
  page,
}) => {
  await page.goto('#lattice-qm');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await page.getByLabel('Quartic warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  for (let i = 0; i < 16; i++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await expect(page.getByTestId('quartic-updates')).toHaveText(String(i + 1));
  }
  await expect(page.getByTestId('quartic-samples')).toHaveText('1');
  const path = page
    .getByRole('region', { name: 'Quartic QM tools' })
    .getByTestId('featured-tool')
    .getByRole('img', { name: /Current periodic path/ })
    .locator('polyline');
  const first = await path.getAttribute('points');
  const deck = page.getByRole('region', { name: 'Quartic QM tools' });
  await selectDetail(page, 2);
  await deck
    .getByTestId('teaching-tool')
    .nth(1)
    .getByRole('button', { name: 'Feature' })
    .click();
  await expect(deck.getByTestId('featured-tool')).toContainText(
    'Applied physical potential',
  );
  await deck.getByLabel('Quartic QM tools featured tool').selectOption('path');
  await deck
    .getByTestId('featured-tool')
    .getByLabel('Quartic path range')
    .fill('2');
  await deck
    .getByTestId('featured-tool')
    .getByLabel('Quartic path range')
    .fill('3');
  await expect(page.getByTestId('quartic-updates')).toHaveText('16');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  for (let i = 0; i < 16; i++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await expect(page.getByTestId('quartic-updates')).toHaveText(String(i + 1));
  }
  expect(await path.getAttribute('points')).toBe(first);
});

test('model changes create separate seeded QM sessions and validation rejects invalid measures', async ({
  page,
}) => {
  await page.goto('#lattice-qm');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await page.getByLabel('Quartic lambda').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByRole('alert')).toContainText(/requires r/);
  await page.getByLabel('Quartic preset').selectOption('Gaussian limit');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('quartic-updates')).toHaveText('1');
  await page.getByLabel('Quantum model').selectOption('harmonic');
  await expect(page.getByTestId('oscillator-updates')).toHaveText('0');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await expect(page.getByTestId('quartic-updates')).toHaveText('0');
});

test('under-resolved splitting is not promoted and the analysis worker leaves Step responsive', async ({
  page,
}) => {
  await page.goto('#lattice-qm');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await page.getByLabel('Quartic r').fill('-4');
  await page.getByLabel('Quartic lambda').fill('0.05');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await addTool(page, 'transfer');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('quartic-updates')).toHaveText('1');
  await expect(page.getByTestId('quartic-transfer-status')).toContainText(
    'under-resolved',
    { timeout: 20_000 },
  );
  await expect(
    page.getByText('No trusted gap headline is available.'),
  ).toBeVisible();
});
