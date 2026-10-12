import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const deck = (page: Page) =>
  page.getByRole('region', { name: 'Small Systems tools' });
const step = (page: Page) =>
  page.getByRole('button', { name: 'Step', exact: true });
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('elementary and graph pages use model-appropriate featured displays', async ({
  page,
}, info) => {
  await page.goto('./#small-systems');
  const sidebar = page.getByRole('complementary', {
    name: 'Model and settings',
  });
  for (const [kind, title, defaultTools] of [
    ['gaussian', 'Distribution / histogram', 1],
    ['spin', 'Distribution / histogram', 1],
    ['binomial', 'Distribution / histogram', 1],
    ['ising', 'Spin configuration', 2],
  ] as const) {
    await page
      .getByLabel('Probability model', { exact: true })
      .selectOption(kind);
    await expect(step(page)).toBeEnabled();
    await expect(sidebar.locator('.katex-mathml math').first()).toBeAttached();
    await expect(sidebar.getByText('Model & sampler settings')).toBeVisible();
    await expect(deck(page).getByTestId('featured-tool')).toContainText(title);
    await expect(deck(page).getByTestId('teaching-tool')).toHaveCount(
      defaultTools,
    );
    await expect(
      page.getByRole('button', { name: 'Save current segment' }),
    ).toBeVisible();
    if (kind === 'ising') {
      await expect(
        sidebar.getByText('Geometry & numerical parameters'),
      ).toBeVisible();
      await expect(
        deck(page).getByRole('region', { name: 'Interactive Ising graph' }),
      ).toHaveCount(1);
      await expect(page.locator('.graph-diagram')).toHaveCount(1);
      await expect(page.getByTestId('small-exact-references')).toBeVisible();
    } else {
      await expect(
        deck(page).getByRole('img', {
          name: 'Exact distribution and sampled histogram',
        }),
      ).toBeVisible();
      await expect(
        deck(page)
          .getByLabel('Small Systems tools featured tool')
          .locator('option[value=correlation]'),
      ).toHaveCount(0);
    }
    expect(await noOverflow(page)).toBe(true);
    if (info.project.name !== 'mobile-webkit')
      await page.screenshot({
        path: `docs/screenshots/model-page-stage-d1-${kind}-${info.project.name}.png`,
        fullPage: true,
      });
  }
  await step(page).click();
  await deck(page)
    .getByRole('button', { name: /Select vertex v2,/ })
    .click();
  await deck(page)
    .getByRole('button', { name: 'Plot selected spin v2' })
    .click();
  await expect(deck(page).getByTestId('teaching-tool')).toHaveCount(3);
  await expect(deck(page).getByLabel('Observable for tool 3')).toHaveValue(
    'v2',
  );
  await page
    .getByText('Exact references & diagnostics', { exact: true })
    .click();
  await page
    .getByText('The mathematics & suggested experiments', { exact: true })
    .click();
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d1-exact-notes-${info.project.name}.png`,
      fullPage: true,
    });
  await page
    .getByLabel('Probability model', { exact: true })
    .selectOption('scalar');
  await expect(page.getByLabel('Small Systems tools')).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Real scalar tools' })
      .getByTestId('featured-tool'),
  ).toContainText('Real scalar configuration');
  await expect(page.locator('.tool-featured .scalar-workspace')).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: 'Real scalar tools' }),
  ).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-scalar-${info.project.name}.png`,
      fullPage: true,
    });
});

test('two distribution cards own independent histogram and viewport choices', async ({
  page,
}, info) => {
  await page.goto('./#small-systems');
  await step(page).click();
  const tools = deck(page);
  const first = tools.locator('.small-plot-tool[data-assignment-key="0"]');
  const firstBars = first.locator('path[fill-opacity="0.09"]');
  await expect(firstBars.first()).toBeAttached();
  await tools.getByRole('button', { name: 'Add tool', exact: true }).click();
  await tools.getByLabel('Tool 2 type').selectOption('density');
  const second = tools.locator('.small-plot-tool[data-assignment-key="2"]');
  const secondBars = second.locator('path[fill-opacity="0.09"]');
  await expect(secondBars.first()).toBeAttached();
  await second.getByLabel('Histogram for tool 2').uncheck();
  await expect(secondBars).toHaveCount(0);
  await expect(firstBars.first()).toBeAttached();
  const before = await second
    .getByRole('img', { name: 'Exact distribution and sampled histogram' })
    .getAttribute('data-viewport');
  await tools
    .locator('.tool-card[data-assignment-key="2"]')
    .getByRole('button', { name: /Feature/ })
    .click();
  await expect(
    tools.getByTestId('featured-tool').getByLabel('Histogram for tool 2'),
  ).not.toBeChecked();
  await expect(
    tools
      .getByTestId('featured-tool')
      .getByRole('img', { name: 'Exact distribution and sampled histogram' }),
  ).toHaveAttribute('data-viewport', before!);
  await expect(
    tools
      .locator('.small-plot-tool[data-assignment-key="0"]')
      .getByLabel('Histogram for tool 0'),
  ).toBeChecked();
  await tools.getByRole('button', { name: 'Refit axes' }).click();
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d1-histograms-${info.project.name}.png`,
      fullPage: true,
    });
});

test('tool changes leave seeded scientific captures identical', async ({
  page,
}) => {
  await page.goto('./#small-systems');
  for (let i = 0; i < 5; i++) await step(page).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await expect(page.getByText(/Saved 1 acknowledged segment/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  const tools = deck(page);
  await tools.getByLabel('Histogram for tool 0').uncheck();
  await tools.getByRole('button', { name: 'Add tool', exact: true }).click();
  await tools.getByLabel('Tool 2 type').selectOption('mean');
  await tools.getByRole('button', { name: 'Refit axes' }).click();
  for (let i = 0; i < 5; i++) await step(page).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await expect(page.getByText(/Saved 1 acknowledged segment/)).toBeVisible();
  await page.goto('./#experiments');
  const checks = page.getByRole('checkbox', { name: /^Select / });
  await expect(checks).toHaveCount(2);
  await checks.nth(0).check();
  await checks.nth(1).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download selected JSON bundle' }).click(),
  ]);
  const bundle = JSON.parse(await readFile((await download.path())!, 'utf8'));
  const captures = bundle.records.map(
    (record: { scientific: { capture: unknown } }) => record.scientific.capture,
  );
  expect(captures).toHaveLength(2);
  type ScientificCapture = {
    segment: unknown;
    diagnosticRecord: unknown;
    currentState: unknown;
    seed: number;
    captureUpdate: number;
  };
  const [left, right] = captures as [ScientificCapture, ScientificCapture];
  expect(right.segment).toEqual(left.segment);
  expect(right.diagnosticRecord).toEqual(left.diagnosticRecord);
  expect(right.currentState).toEqual(left.currentState);
  expect(right.seed).toBe(left.seed);
  expect(right.captureUpdate).toBe(left.captureUpdate);
});
