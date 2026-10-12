import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const step = (page: Page) =>
  page.getByRole('button', { name: 'Step', exact: true });
const density = (page: Page) =>
  page
    .getByRole('img', {
      name: 'Exact distribution and sampled histogram',
    })
    .first();
async function apply(page: Page, a: string, h: string) {
  const input = page.getByLabel('Quadratic coefficient');
  if (!(await input.isVisible()))
    await page.getByText('Model & sampler settings', { exact: true }).click();
  await input.fill(a);
  await page.getByLabel('Source h', { exact: true }).fill(h);
  await page
    .getByRole('button', { name: 'Apply settings', exact: true })
    .click();
}
async function sampleBatch(page: Page) {
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('sample-count').textContent()),
    )
    .toBeGreaterThanOrEqual(128);
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('Paused');
}

test('production subpath loads workers and locally bundled accessible math', async ({
  page,
}) => {
  const errors: string[] = [],
    assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
    if (response.url().includes('/assets/')) assets.push(response.url());
  });
  await page.goto('./#small-systems');
  await expect(step(page)).toBeEnabled();
  await page.reload();
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.locator('.katex-mathml math').first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
  expect(assets.some((url) => url.includes('simulation.worker'))).toBe(true);
  expect(assets.some((url) => /KaTeX.*woff/.test(url))).toBe(true);
  expect(assets.every((url) => url.includes('/lattice/assets/'))).toBe(true);
  await expect(
    page.getByRole('navigation', { name: 'Workspaces' }).getByRole('link'),
  ).toHaveCount(5);
});

test('settings, display changes, and keyboard controls preserve seed replay', async ({
  page,
}) => {
  await page.goto('./');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const first = await page.getByTestId('current-value').textContent();
  const settings = page.getByText('Model & sampler settings', { exact: true });
  await settings.focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('complementary', { name: 'Model and settings' })
    .getByText('Reset seed', { exact: true })
    .click();
  await expect(page.getByLabel('Seed on Reset')).toBeVisible();
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Seed on Reset')).not.toBeVisible();
  await page.getByLabel('Histogram for tool 0', { exact: true }).uncheck();
  await page.getByLabel('Histogram for tool 0', { exact: true }).check();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  await step(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByTestId('current-value')).toHaveText(first!);
});

test('parameter switching preserves old segments, current value, and axes; Reset clears and recenters', async ({
  page,
}) => {
  await page.goto('./');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const current = await page.getByTestId('current-value').textContent();
  const before = JSON.parse(
    (await density(page).getAttribute('data-viewport'))!,
  );
  await apply(page, '0', '0');
  await expect(page.getByRole('alert')).toContainText('a must be positive');
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await apply(page, '4', '2');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('exact-mean')).toHaveText('0.5');
  await expect(page.getByTestId('exact-variance')).toHaveText('0.25');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  await expect(page.getByTestId('segment-1')).toContainText('N=1');
  await expect(page.getByTestId('current-value')).toHaveText(current!);
  const after = JSON.parse(
    (await density(page).getAttribute('data-viewport'))!,
  );
  expect(after.min).toBe(before.min);
  expect(after.max).toBe(before.max);
  expect(after.yMax).toBeGreaterThanOrEqual(before.yMax);
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByTestId('total-updates')).toHaveText('2');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(step(page)).toBeEnabled();
  await expect(page.getByTestId('segment-2')).toHaveCount(0);
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  const reset = JSON.parse(
    (await density(page).getAttribute('data-viewport'))!,
  );
  expect(reset.min).toBe(-1.5);
  expect(reset.max).toBe(2.5);
  await expect(page.getByTestId('current-value')).toHaveText('—');
});

test('Refit axes adjusts only the viewport and leaves history and RNG untouched', async ({
  page,
}) => {
  await page.goto('./');
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  const tall = JSON.parse(
    (await density(page).getAttribute('data-viewport'))!,
  ).yMax;
  await sampleBatch(page);
  const count = await page.getByTestId('sample-count').textContent(),
    value = await page.getByTestId('current-value').textContent();
  const history = await page
    .getByRole('region', { name: 'Recent measurement segments' })
    .textContent();
  await page.getByRole('button', { name: 'Refit axes', exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse((await density(page).getAttribute('data-viewport'))!).yMax,
    )
    .toBeLessThan(tall);
  await expect(page.getByTestId('sample-count')).toHaveText(count!);
  await expect(page.getByTestId('current-value')).toHaveText(value!);
  await expect(
    page.getByRole('region', { name: 'Recent measurement segments' }),
  ).toHaveText(history!);
});

test('teaching tools add, collapse, feature, expand and rearrange without sampling', async ({
  page,
}, info) => {
  await page.goto('./');
  await sampleBatch(page);
  const count = await page.getByTestId('sample-count').textContent();
  const value = await page.getByTestId('current-value').textContent();
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('featured-tool'),
  ).toContainText('Distribution / histogram');
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(1);
  const add = page.getByRole('button', { name: 'Add tool', exact: true });
  await add.click();
  const errorCard = page.locator('[data-assignment-key="2"]').first();
  await errorCard.getByLabel('Tool 2 type').selectOption('error');
  await expect(errorCard).toContainText('Absolute error (log–log)');
  await errorCard.getByRole('button', { name: /Collapse/ }).click();
  await expect(errorCard).toHaveClass(/tool-collapsed/);
  await errorCard.getByRole('button', { name: /Open/ }).click();
  await errorCard.getByRole('button', { name: /Move earlier/ }).click();
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('teaching-tool')
      .first(),
  ).toHaveAttribute('data-assignment-key', '2');
  await errorCard.getByRole('button', { name: /Expand/ }).click();
  await expect(errorCard).toHaveClass(/tool-expanded/);
  await errorCard.getByRole('button', { name: /Feature/ }).click();
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('featured-tool'),
  ).toContainText('Absolute error (log–log)');
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('teaching-tool')
      .first(),
  ).toHaveAttribute('data-assignment-key', '0');
  for (let i = 0; i < 4; i++) await add.click();
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(6);
  await expect(add).toBeDisabled();
  for (let i = 0; i < 6; i++) {
    const first = page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('teaching-tool')
      .first();
    const detail = page.getByLabel('Small Systems tools detail tool');
    if (await detail.isVisible())
      await detail.selectOption(
        (await first.getAttribute('data-assignment-key'))!,
      );
    await first.getByRole('button', { name: /Remove/ }).click();
  }
  await expect(
    page
      .getByRole('region', { name: 'Small Systems tools' })
      .getByTestId('teaching-tool'),
  ).toHaveCount(0);
  await expect(page.getByText('No gallery tools are open.')).toBeVisible();
  await add.click();
  await expect(page.getByTestId('sample-count')).toHaveText(count!);
  await expect(page.getByTestId('current-value')).toHaveText(value!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name !== 'desktop') {
    await page.setViewportSize({ width: 780, height: 360 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('Run, parameter Apply, Pause, and Step use distinct segments in order', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '▷ Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('total-updates').textContent()),
    )
    .toBeGreaterThan(0);
  await apply(page, '2', '3');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(page.getByTestId('run-status')).toHaveText('Paused');
  const paused = Number(await page.getByTestId('sample-count').textContent());
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText(String(paused + 1));
  await expect(page.getByTestId('segment-1')).toBeVisible();
});

test('worker failure is visible and Reset can recover', async ({ page }) => {
  await page.route('**/simulation.worker-*.js', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Reset');
  await expect(step(page)).toBeDisabled();
  await page.unroute('**/simulation.worker-*.js');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await step(page).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
