import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const deck = (page: Page) =>
  page.getByRole('region', { name: 'Real scalar tools' });
const card = (page: Page, key: number) =>
  deck(page).locator(
    `[data-testid="teaching-tool"][data-assignment-key="${key}"]`,
  );
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const step = (page: Page) =>
  page.getByRole('button', { name: 'Step', exact: true });

async function scalar(page: Page) {
  await page.goto('./#small-systems');
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('scalar');
  await expect(deck(page).getByTestId('featured-tool')).toContainText(
    'Real scalar configuration',
  );
}
async function showCard(page: Page, key: number) {
  if (!(await card(page, key).getByLabel(`Tool ${key} type`).isVisible()))
    await deck(page)
      .getByLabel('Real scalar tools detail tool')
      .selectOption(String(key));
}
async function editor(page: Page) {
  if (!(await page.getByLabel('Scalar preset').isVisible()))
    await page
      .getByText('Geometry & scalar parameters', { exact: true })
      .click();
}
async function references(page: Page) {
  const details = page.getByTestId('small-scalar-references');
  if (!(await details.locator('.moments-panel').isVisible()))
    await details.locator('summary').first().click();
}
async function local(page: Page) {
  const details = page.getByText('Local scalar inspection', { exact: true });
  if (!(await page.getByTestId('scalar-site-panel').isVisible()))
    await details.click();
}

test('scalar graph, sidebar editor, local focus and Gaussian references', async ({
  page,
}, info) => {
  await scalar(page);
  const tools = deck(page);
  await expect(tools.getByTestId('teaching-tool')).toHaveCount(2);
  await expect(card(page, 1).getByLabel('Tool 1 type')).toHaveValue(
    'histogram',
  );
  await showCard(page, 2);
  await expect(card(page, 2).getByLabel('Tool 2 type')).toHaveValue('scatter');
  await expect(page.locator('.scalar-workspace .graph-diagram')).toHaveCount(1);
  const sidebar = page.getByRole('complementary', {
    name: 'Model and settings',
  });
  await expect(sidebar.locator('.katex-mathml math').first()).toBeAttached();
  await expect(sidebar.getByText('Geometry & scalar parameters')).toBeVisible();
  await step(page).click();
  await expect(
    tools.getByRole('button', { name: /Select variable v1,/ }),
  ).toBeVisible();
  await tools.getByRole('button', { name: /Select variable v1,/ }).click();
  await expect(tools.getByLabel('Selected site')).toHaveValue('v1');
  await tools.getByRole('button', { name: /Select bond e0,/ }).focus();
  await page.keyboard.press('Enter');
  await local(page);
  await page.getByTestId('scalar-site-panel').locator('summary').click();
  await expect(page.getByTestId('scalar-site-panel')).toContainText(
    'not the equilibrium marginal',
  );
  await page.getByTestId('scalar-bond-panel').locator('summary').click();
  await page.getByRole('button', { name: 'Edit coupling e0' }).click();
  await expect(page.getByLabel('Coupling e0')).toBeFocused();
  await references(page);
  await expect(
    page.getByText('Analytic exact multivariate Gaussian', { exact: false }),
  ).toBeVisible();
  await page
    .getByText('Exact Gaussian precision, covariance & pair moments')
    .click();
  for (const caption of [
    'Precision Q',
    'Covariance C = Q⁻¹',
    'Pair moments ⟨xᵢxⱼ⟩',
  ])
    await expect(page.getByRole('table', { name: caption })).toBeVisible();
  await expect(page.getByTestId('scalar-transition-details')).toContainText(
    'whole-vector independent Gaussian draw',
  );
  expect(await noOverflow(page)).toBe(true);
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-gaussian-reference-${info.project.name}.png`,
      fullPage: true,
    });
});

test('all ten scalar tools and target applicability remain available', async ({
  page,
}) => {
  await scalar(page);
  await step(page).click();
  await showCard(page, 2);
  const selector = card(page, 2).getByLabel('Tool 2 type');
  for (const id of [
    'histogram',
    'trajectory',
    'mean',
    'error',
    'bare',
    'conditional-potential',
    'conditional-density',
    'scatter',
    'covariance',
    'acceptance',
  ]) {
    await selector.selectOption(id);
    await expect(selector).toHaveValue(id);
    if (['scatter', 'covariance', 'acceptance'].includes(id))
      await expect(
        card(page, 2).getByLabel('Observable for tool 2'),
      ).toHaveCount(0);
    else
      await expect(
        card(page, 2).getByLabel('Observable for tool 2'),
      ).toBeVisible();
  }
  await card(page, 2).getByLabel('Tool 2 type').selectOption('histogram');
  for (const target of ['v1', 'v0²', 'v0·v1', 'sum', 'mean', 'S'])
    await card(page, 2)
      .getByLabel('Observable for tool 2')
      .selectOption(target);
  await card(page, 2)
    .getByLabel('Tool 2 type')
    .selectOption('conditional-density');
  await expect(card(page, 2)).toContainText('Choose an individual site');
  await expect(card(page, 2).getByLabel('Observable for tool 2')).toHaveValue(
    '',
  );
  await card(page, 2).getByLabel('Observable for tool 2').selectOption('v1');
  await expect(
    card(page, 2).getByRole('img', { name: 'Conditional probability density' }),
  ).toBeVisible();
  await expect(card(page, 2)).toContainText('not the equilibrium marginal');
  await card(page, 2).getByLabel('Tool 2 type').selectOption('scatter');
  await expect(card(page, 2)).toContainText('Sampled v0 versus v1');
  await showCard(page, 1);
  await card(page, 1)
    .getByRole('button', { name: 'Marginal histogram: Feature' })
    .click();
  await expect(deck(page).getByTestId('featured-tool')).toContainText(
    'Marginal histogram',
  );
  await expect(page.locator('.scalar-workspace .graph-diagram')).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);
});

test('quartic references, sampled-only overlay and parameter segments', async ({
  page,
}, info) => {
  await scalar(page);
  await editor(page);
  await page.getByLabel('Scalar preset').selectOption('double-well');
  await references(page);
  await expect(
    page.getByText('Numerical quadrature reference', { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByTestId('small-scalar-references')).toContainText(
    'tail bound',
  );
  await expect(card(page, 2).getByLabel('Tool 2 type')).toHaveValue('bare');
  await step(page).click();
  await editor(page);
  await page.getByLabel('Source h v0').fill('0.5');
  await page.getByRole('button', { name: 'Apply scalar parameters' }).click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await showCard(page, 2);
  await card(page, 2)
    .getByLabel('Tool 2 type')
    .selectOption('conditional-density');
  await expect(card(page, 2)).toContainText('not the equilibrium marginal');
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-conditional-density-${info.project.name}.png`,
      fullPage: true,
    });
  await card(page, 2)
    .getByLabel('Tool 2 type')
    .selectOption('conditional-potential');
  await expect(card(page, 2)).toContainText(
    'vertical axis is action, not density',
  );
  await card(page, 2).getByLabel('Tool 2 type').selectOption('bare');
  await expect(card(page, 2)).toContainText('Bare on-site energy');
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-double-well-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByLabel('Scalar preset').selectOption('tilted-well');
  await expect(
    page.getByRole('heading', { name: 'Single site', exact: true }),
  ).toBeVisible();
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-tilted-well-${info.project.name}.png`,
      fullPage: true,
    });
  await editor(page);
  await page.getByLabel('Scalar preset').selectOption('four-quartic');
  await references(page);
  await expect(page.getByTestId('small-scalar-references')).toContainText(
    'Sampled only',
  );
  await showCard(page, 1);
  await card(page, 1).getByLabel('Histogram for tool 1').uncheck();
  await expect(card(page, 1)).toContainText('Empirical histogram hidden');
  await card(page, 1).getByLabel('Histogram for tool 1').check();
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(page.getByTestId('scalar-transition-details')).toContainText(
    'random-site Metropolis',
  );
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-four-quartic-${info.project.name}.png`,
      fullPage: true,
    });
});

test('trajectory history and target survive feature exchange; controls leave updates unchanged', async ({
  page,
}, info) => {
  await scalar(page);
  for (let i = 0; i < 12; i++) await step(page).click();
  const before = await page.getByTestId('scalar-configuration').textContent();
  await showCard(page, 2);
  await card(page, 2).getByLabel('Tool 2 type').selectOption('trajectory');
  await card(page, 2).getByLabel('Observable for tool 2').selectOption('v1');
  await card(page, 2).getByText('Window & history').click();
  await card(page, 2)
    .getByLabel('Scalar trajectory window')
    .selectOption('500');
  await card(page, 2).getByLabel('Scalar trajectory end update').fill('8');
  await expect(card(page, 2).getByLabel('Follow latest')).not.toBeChecked();
  await card(page, 2)
    .getByRole('button', { name: 'Sample trajectory: Feature' })
    .click();
  const featured = deck(page).getByTestId('featured-tool');
  await expect(featured).toContainText('Sample trajectory');
  await expect(featured.getByLabel('Observable for tool 2')).toHaveValue('v1');
  await featured.getByText('Window & history').click();
  await expect(featured.getByLabel('Scalar trajectory window')).toHaveValue(
    '500',
  );
  await expect(featured.getByLabel('Scalar trajectory end update')).toHaveValue(
    '8',
  );
  await expect(
    featured.getByRole('img', {
      name: 'Scalar sample trajectory by elementary update',
    }),
  ).toHaveAttribute('data-viewport', /"lastShown":8/);
  await expect(page.locator('.scalar-workspace .graph-diagram')).toHaveCount(1);
  await expect(page.getByTestId('scalar-configuration')).toHaveText(before!);
  await deck(page).getByRole('button', { name: 'Refit axes' }).click();
  await expect(page.getByTestId('total-updates')).toHaveText('12');
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-featured-trajectory-${info.project.name}.png`,
      fullPage: true,
    });
});

test('two histogram assignments keep independent overlays and expanding axes', async ({
  page,
}) => {
  await scalar(page);
  await step(page).click();
  const first = card(page, 1);
  const second = card(page, 2);
  const before = JSON.parse(
    (await first
      .getByRole('img', {
        name: 'Sampled marginal and available reference density',
      })
      .getAttribute('data-viewport'))!,
  );
  await showCard(page, 2);
  await card(page, 2).getByLabel('Tool 2 type').selectOption('histogram');
  await card(page, 2).getByLabel('Observable for tool 2').selectOption('v1');
  await second.getByLabel('Histogram for tool 2').uncheck();
  await showCard(page, 1);
  await expect(first.getByLabel('Histogram for tool 1')).toBeChecked();
  await showCard(page, 2);
  await expect(second.getByLabel('Histogram for tool 2')).not.toBeChecked();
  await expect(second.locator('path[stroke-dasharray="5 3"]')).toHaveCount(1);
  await editor(page);
  await page.getByLabel('Source h v0').fill('6');
  await page.getByRole('button', { name: 'Apply scalar parameters' }).click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await showCard(page, 1);
  const after = JSON.parse(
    (await first
      .getByRole('img', {
        name: 'Sampled marginal and available reference density',
      })
      .getAttribute('data-viewport'))!,
  );
  expect(after.min).toBeLessThanOrEqual(before.min);
  expect(after.max).toBeGreaterThanOrEqual(before.max);
  const updates = await page.getByTestId('total-updates').textContent();
  await showCard(page, 2);
  await second
    .getByRole('button', { name: 'Marginal histogram: Feature' })
    .click();
  await expect(
    deck(page).getByTestId('featured-tool').getByLabel('Histogram for tool 2'),
  ).not.toBeChecked();
  await showCard(page, 1);
  await expect(card(page, 1).getByLabel('Histogram for tool 1')).toBeChecked();
  await deck(page).getByRole('button', { name: 'Refit axes' }).click();
  await expect(page.getByTestId('total-updates')).toHaveText(updates!);
});

test('scalar tool edits preserve a complete seeded scientific capture', async ({
  page,
}) => {
  await scalar(page);
  for (let i = 0; i < 5; i++) await step(page).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await expect(page.getByText(/Saved 1 acknowledged segment/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await showCard(page, 1);
  await card(page, 1).getByLabel('Histogram for tool 1').uncheck();
  await showCard(page, 2);
  await card(page, 2).getByLabel('Tool 2 type').selectOption('trajectory');
  await card(page, 2).getByLabel('Observable for tool 2').selectOption('v1');
  await deck(page).getByRole('button', { name: 'Refit axes' }).click();
  await deck(page)
    .getByRole('button', { name: 'Plot selected field v0' })
    .click();
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
  const [left, right] = captures as Array<Record<string, unknown>>;
  for (const field of [
    'segment',
    'diagnosticRecord',
    'currentState',
    'seed',
    'captureUpdate',
  ])
    expect(right![field]).toEqual(left![field]);
});

test('six-card limit and phone detail/overview retain a usable page', async ({
  page,
}, info) => {
  await scalar(page);
  const tools = deck(page);
  for (let i = 0; i < 4; i++)
    await tools.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(tools.getByTestId('teaching-tool')).toHaveCount(6);
  await expect(
    tools.getByRole('button', { name: 'Add tool', exact: true }),
  ).toBeDisabled();
  if (info.project.name !== 'desktop') {
    await tools.getByRole('button', { name: 'Compact overview' }).click();
    await expect(
      tools.getByRole('region', { name: 'Interactive real scalar graph' }),
    ).toBeVisible();
    await expect(tools.getByTestId('teaching-tool')).toHaveCount(6);
    await tools.getByRole('button', { name: 'Single detail' }).click();
    await tools.getByLabel('Real scalar tools detail tool').selectOption('6');
    await expect(card(page, 6).getByLabel('Tool 6 type')).toBeVisible();
  }
  expect(await noOverflow(page)).toBe(true);
  if (info.project.name !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/model-page-stage-d2-six-tools-${info.project.name}.png`,
      fullPage: true,
    });
  for (let key = 6; key >= 1; key--) {
    await showCard(page, key);
    await card(page, key)
      .getByRole('button', { name: /Remove/ })
      .click();
  }
  await expect(tools.getByTestId('teaching-tool')).toHaveCount(0);
  await expect(tools).toContainText('No gallery tools are open');
  await tools.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(tools.getByTestId('teaching-tool')).toHaveCount(1);
  await expect(tools.locator('.tool-grid-single')).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);
});
