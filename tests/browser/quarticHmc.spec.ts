import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openQuartic(page: Page) {
  await page.goto('#lattice-qm');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await expect(page.getByTestId('quartic-updates')).toHaveText('0');
}

async function applyHmc(page: Page, warmup = '0', stride = '1') {
  await page.getByLabel('Quartic sampler').selectOption('hmc');
  await page.getByLabel('HMC warm-up trajectories').fill(warmup);
  await page.getByLabel('HMC stride trajectories').fill(stride);
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByText(/Applied sampler: HMC/)).toBeVisible();
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
  const detail = page.getByLabel('Quartic QM tools detail tool');
  if (await detail.isVisible())
    await detail.selectOption(
      (await cards.last().getAttribute('data-assignment-key'))!,
    );
}

test('HMC settings, trajectory cadence, inspection, segments and phone layout', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openQuartic(page);
  await page.getByLabel('Quartic sampler').selectOption('hmc');
  await page.getByLabel('HMC step size').fill('0.3');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  expect(
    await page
      .getByLabel('HMC step size')
      .evaluate((input: HTMLInputElement) => input.validity.rangeOverflow),
  ).toBe(true);
  await expect(page.getByTestId('quartic-updates')).toHaveText('0');
  await page.getByLabel('HMC step size').fill('0.1');
  await page.getByLabel('HMC warm-up trajectories').fill('2');
  await page.getByLabel('HMC stride trajectories').fill('2');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await addTool(page, 'hmc');
  await addTool(page, 'transition');
  for (let update = 1; update <= 6; update++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await expect(page.getByTestId('quartic-updates')).toHaveText(
      String(update),
    );
    await expect(page.getByTestId('quartic-samples')).toHaveText(
      String(Math.floor(Math.max(0, update - 2) / 2)),
    );
  }
  await expect(page.getByText(/whole-path HMC trajectory ε=/)).toBeVisible();
  const cards = page
    .getByRole('region', { name: 'Quartic QM tools' })
    .getByTestId('teaching-tool');
  const detail = page.getByLabel('Quartic QM tools detail tool');
  if (await detail.isVisible())
    await detail.selectOption(
      (await cards.nth(2).getAttribute('data-assignment-key'))!,
    );
  await expect(page.getByText(/gradient work/i).first()).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Recent signed auxiliary/ }),
  ).toBeVisible();
  await page.getByLabel('Quartic h').fill('0.4');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await expect(page.getByTestId('quartic-samples')).toHaveText('0');
  await expect(page.getByText(/Segment 2; ε=/)).toBeVisible();
  await expect(page.getByText(/Segment 3; ε=/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone')
    await page.screenshot({
      path: `docs/screenshots/m4c2-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await page.getByLabel('Quartic sampler').selectOption('metropolis');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  if (await detail.isVisible())
    await detail.selectOption(
      (await cards.nth(3).getAttribute('data-assignment-key'))!,
    );
  await expect(page.getByText(/site .*proposed ΔS/)).toBeVisible();
  await expect(
    page.getByText(/one transition is a local site attempt/),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('HMC Run/Pause, Reset replay and presentation changes preserve the worker stream', async ({
  page,
}) => {
  await openQuartic(page);
  await applyHmc(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('quartic-updates')).toHaveText('1');
  const path = page
    .getByRole('region', { name: 'Quartic QM tools' })
    .getByTestId('featured-tool')
    .getByRole('img', { name: /Current periodic path/ })
    .locator('polyline');
  const firstPath = await path.getAttribute('points');
  await addTool(page, 'hmc');
  await page.getByLabel('Quartic path range').fill('4');
  await page.getByLabel('Quartic path range').fill('3');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('quartic-updates')).toHaveText('1');
  expect(await path.getAttribute('points')).toBe(firstPath);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('quartic-updates').textContent()),
    )
    .toBeGreaterThan(16);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  // Pause lets the in-flight worker batch finish; read its acknowledged count.
  await expect(
    page.getByRole('button', { name: 'Step', exact: true }),
  ).toBeEnabled();
  const paused = Number(
    await page.getByTestId('quartic-updates').textContent(),
  );
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('quartic-updates')).toHaveText(
    String(paused + 1),
  );
  await page.getByLabel('Quantum model').selectOption('harmonic');
  await expect(page.getByTestId('oscillator-updates')).toHaveText('0');
  await page.getByLabel('Quantum model').selectOption('quartic');
  await expect(page.getByTestId('quartic-updates')).toHaveText('0');
});

test('worst-case HMC batch remains responsive with transfer analysis open', async ({
  page,
}, testInfo) => {
  await openQuartic(page);
  await page.getByLabel('Quartic sampler').selectOption('hmc');
  await page.getByLabel('HMC step size').fill('0.02');
  await page.getByLabel('HMC leapfrog steps').fill('32');
  await page.getByLabel('HMC warm-up trajectories').fill('0');
  await addTool(page, 'transfer');
  for (const sites of [16, 64]) {
    await page.getByLabel('Quartic sites').fill(String(sites));
    await page.getByRole('button', { name: 'Apply parameters' }).click();
    await expect(page.getByTestId('quartic-updates')).toHaveText('0');
    const start = Date.now();
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect
      .poll(async () =>
        Number(await page.getByTestId('quartic-updates').textContent()),
      )
      .toBeGreaterThanOrEqual(16);
    const elapsed = Date.now() - start;
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByTestId('quartic-transfer-status')).toContainText(
      /resolved|under-resolved/,
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    console.log(
      `M4c2 ${testInfo.project.name} N${sites} L32 Run-to-16 DOM latency: ${elapsed} ms`,
    );
    expect(elapsed).toBeLessThan(15_000);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test('the HMC inspector identifies an actual rejected whole-path proposal', async ({
  page,
}) => {
  await openQuartic(page);
  await page.getByLabel('Quartic sites').fill('4');
  await page.getByLabel('Quartic beta').fill('2');
  await page.getByLabel('Quartic r').fill('16');
  await page.getByLabel('Quartic lambda').fill('4');
  await page.getByLabel('Quartic sampler').selectOption('hmc');
  await page.getByLabel('HMC step size').fill('0.25');
  await page.getByLabel('HMC leapfrog steps').fill('32');
  await page.getByLabel('HMC warm-up trajectories').fill('0');
  await page.getByRole('button', { name: 'Apply parameters' }).click();
  await addTool(page, 'transition');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByText(/whole-path HMC trajectory ε=/)).toContainText(
    /rejected|divergence/,
  );
  await expect(page.getByTestId('quartic-samples')).toHaveText('1');
});
