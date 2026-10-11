import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function detail(
  page: Page,
  workspace: 'Lattice QM' | 'Lattice Fields',
  key: number,
) {
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
  await page.getByLabel('Lattice QM tools add tool type').selectOption('gap');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
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
  ).toHaveCount(3);
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
  ).toHaveCount(2);
  await expect(page.getByTestId('oscillator-quadrature-quality')).toHaveCount(
    0,
  );
  await page
    .getByLabel('Lattice QM tools add tool type')
    .selectOption('transfer');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(page.getByTestId('oscillator-quadrature-quality')).toBeVisible();
  const phoneDetail = page.getByLabel('Lattice QM tools detail tool');
  if (await phoneDetail.isVisible()) {
    await phoneDetail.selectOption('0');
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
    .getByLabel('Tool 2 type')
    .selectOption('history');
  await expect(
    page.getByRole('heading', {
      name: 'Recent path-average history',
      level: 3,
    }),
  ).toBeVisible();
  await page.getByLabel('Oscillator omega').fill('2');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Recent path-average history',
      level: 3,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Recent path-average history: Remove' })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Lattice QM tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Current periodic path: Remove' })
    .click();
  await page
    .getByRole('button', { name: 'Euclidean two-point correlator: Remove' })
    .click();
  await expect(
    page.getByText('No tools are open. Choose a tool and Add tool.'),
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
  await page
    .getByLabel('Lattice QM tools add tool type')
    .selectOption('reflection');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
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
  await page
    .getByLabel('Lattice Fields tools add tool type')
    .selectOption('spectrum');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(
    page
      .getByText(/Full periodicity is required for these momentum eigenmodes/)
      .first(),
  ).toBeVisible();
  for (let i = 0; i < 3; i++)
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
