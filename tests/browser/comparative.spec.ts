import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const step = (page: Page) =>
  page.getByRole('button', { name: 'Step', exact: true });
async function settings(page: Page) {
  if (!(await page.getByLabel('Sampling algorithm').isVisible()))
    await page.getByText('Model & sampler settings', { exact: true }).click();
}
async function sampler(page: Page, kind: string, warmup = '3') {
  await settings(page);
  await page.getByLabel('Sampling algorithm').selectOption(kind);
  if (kind === 'metropolis')
    await page.getByLabel('Warm-up updates', { exact: true }).fill(warmup);
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
  await expect(step(page)).toBeEnabled();
}
async function model(page: Page, kind: string) {
  await page
    .getByLabel('Probability model', { exact: true })
    .selectOption(kind);
  await expect(step(page)).toBeEnabled();
  await expect(
    page.getByLabel('Probability model', { exact: true }),
  ).toHaveValue(kind);
}
async function overview(page: Page) {
  const toggle = page.getByRole('button', {
    name: '2 × 2 overview',
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('single-spin exact references, direct and heat-bath draws have coherent inspection', async ({
  page,
}, info) => {
  await page.goto('./');
  await model(page, 'spin');
  await expect(page.getByTestId('exact-mean')).toHaveText('0');
  await expect(page.getByTestId('exact-variance')).toHaveText('1');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByTestId('transition-details')).toContainText(
    'Independent draw',
  );
  await expect(page.getByTestId('transition-details')).toContainText(
    'No Metropolis acceptance test',
  );
  await expect(page.getByTestId('transition-result')).toHaveText(
    (await page.getByTestId('current-value').textContent())!,
  );
  await sampler(page, 'heat-bath');
  await step(page).click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('segment-1')).toContainText('N=1');
  await expect(page.getByTestId('warmup-count')).toHaveText('0 / 0');
  await expect(page.getByTestId('transition-details')).toContainText(
    'heat-bath resample',
  );
  await overview(page);
  await expect(
    page
      .getByRole('img', { name: 'Exact distribution and sampled histogram' })
      .locator('rect'),
  ).not.toHaveCount(0);
  await expect(page.getByTestId('independent-band')).toHaveCount(0);
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath('spin-heat-bath.png'),
    fullPage: true,
  });
});

test('Metropolis excludes warm-up and displays a complete consistent transition', async ({
  page,
}, info) => {
  await page.goto('./');
  await sampler(page, 'metropolis', '3');
  await expect(page.getByTestId('current-value')).toHaveText('0');
  for (let n = 1; n <= 4; n++) {
    await step(page).click();
    await expect(page.getByTestId('segment-updates')).toHaveText(String(n));
    await expect(page.getByTestId('sample-count')).toHaveText(
      String(Math.max(0, n - 3)),
    );
    await expect(page.getByTestId('transition-result')).toHaveText(
      (await page.getByTestId('current-value').textContent())!,
    );
  }
  await expect(page.getByTestId('warmup-count')).toHaveText('3 / 3');
  const inspection = page.getByTestId('transition-details');
  for (const label of [
    'Before',
    'Proposed',
    'Accept probability α',
    'Uniform draw u',
    'Result',
  ])
    await expect(inspection.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByTestId('transition-outcome')).toContainText(
    /Accepted|Rejected/,
  );
  await overview(page);
  await expect(page.getByLabel('Plot for slot 4')).toHaveValue('x:acceptance');
  await expect(
    page.getByRole('group', { name: 'Metropolis acceptance diagnostics' }),
  ).toBeVisible();
  await expect(page.getByTestId('independent-band')).toHaveCount(0);
  await noOverflow(page);
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await page.screenshot({
    path: info.outputPath('gaussian-metropolis.png'),
    fullPage: true,
  });
});

test('binomial parameter histories, support changes and Reset stay in the correct model session', async ({
  page,
}, info) => {
  await page.goto('./');
  await model(page, 'binomial');
  await expect(page.getByTestId('exact-mean')).toHaveText('10');
  await expect(page.getByTestId('exact-variance')).toHaveText('5');
  await settings(page);
  await page.getByLabel('Bernoulli count n').fill('100');
  await page.getByLabel('Success probability p').fill('0.999');
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
  await sampler(page, 'metropolis', '2');
  await expect(page.getByTestId('current-value')).toHaveText('100');
  await page.getByLabel('Bernoulli count n').fill('3');
  await page.getByLabel('Success probability p').fill('0.5');
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
  await expect(page.getByTestId('current-value')).toHaveText('3');
  await expect(
    page.getByText(/clamped to the new support/).first(),
  ).toBeVisible();
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(page.getByTestId('segment-1')).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  await expect(
    page.getByLabel('Probability model', { exact: true }),
  ).toHaveValue('binomial');
  await expect(page.getByTestId('current-value')).toHaveText('2');
  await expect(page.getByTestId('segment-2')).toHaveCount(0);
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  for (let i = 1; i <= 4; i++) {
    await step(page).click();
    await expect(page.getByTestId('total-updates')).toHaveText(String(i));
  }
  await expect(page.getByTestId('sample-count')).toHaveText('2');
  await overview(page);
  await noOverflow(page);
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await page.screenshot({
    path: info.outputPath('binomial-metropolis.png'),
    fullPage: true,
  });
  await model(page, 'spin');
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  await expect(page.getByLabel('Plot for slot 1')).toHaveValue('s:density');
});

test('thousands of updates, Pause, Step and retained trajectory browsing preserve numerical state', async ({
  page,
}, info) => {
  await page.goto('./');
  await sampler(page, 'metropolis', '200');
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('total-updates').textContent()),
    )
    .toBeGreaterThanOrEqual(2048);
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  const total = Number(await page.getByTestId('total-updates').textContent());
  await expect(page.getByTestId('sample-count')).toHaveText(
    String(total - 200),
  );
  for (let i = 1; i <= 3; i++) {
    await step(page).click();
    await expect(page.getByTestId('total-updates')).toHaveText(
      String(total + i),
    );
  }
  const value = await page.getByTestId('current-value').textContent();
  await overview(page);
  const trajectory = page.getByRole('article', {
    name: 'Plot slot 2',
    exact: true,
  });
  await expect(trajectory.getByTestId('trajectory-retention')).toContainText(
    '100 exact transitions shown',
  );
  await trajectory.getByText('Window & history', { exact: true }).click();
  await trajectory.getByLabel('Trajectory window').selectOption('500');
  await trajectory.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(trajectory.getByLabel('Trajectory end update')).toHaveValue(
    String(total + 3 - 500),
  );
  await expect(page.getByTestId('total-updates')).toHaveText(String(total + 3));
  await expect(page.getByTestId('current-value')).toHaveText(value!);
  await page.getByRole('button', { name: 'Fit All', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText(
    String(total + 3 - 200),
  );
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath('history-browsing.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('total-updates').textContent()),
    )
    .toBeGreaterThan(total + 3);
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(step(page)).toBeEnabled();
});

test('invalid sampler and discrete parameters leave measurements intact; model notes render locally', async ({
  page,
}) => {
  await page.goto('./');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await settings(page);
  await page.getByLabel('Sampling algorithm').selectOption('metropolis');
  await page.getByLabel('Proposal half-width δ').fill('0');
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('half-width');
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await model(page, 'binomial');
  await settings(page);
  await page.getByLabel('Success probability p').fill('1');
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('finite log-odds');
  await expect(page.getByTestId('exact-mean')).toHaveText('10');
  await page
    .getByText('The mathematics & suggested experiments', { exact: true })
    .click();
  await expect(
    page.locator('#model-notes .katex-mathml math').first(),
  ).toBeAttached();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await noOverflow(page);
});
