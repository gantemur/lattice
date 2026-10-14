import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
test.describe.configure({ timeout: 90000 });
const root = (p: Page) => p.locator('.xy-workspace:visible');
const feature = (p: Page) => root(p).getByTestId('featured-tool');
const button = (p: Page, name: string) =>
  root(p).getByRole('button', { name, exact: true });
const updates = (p: Page) => root(p).getByTestId('xy-updates');
async function settings(p: Page) {
  if (
    !(await root(p)
      .locator('details.settings-panel')
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await root(p).getByText('XY settings', { exact: true }).click();
}
async function open(p: Page, example = 'xy-rotor') {
  await p.goto('./#small-systems');
  await p.getByLabel('Named example', { exact: true }).selectOption(example);
  await expect(button(p, 'Step')).toBeEnabled();
  await settings(p);
}
async function show(p: Page, id: string) {
  await root(p).getByLabel('XY tools featured tool').selectOption(id);
}
async function apply(p: Page) {
  await button(p, 'Apply XY settings').click();
  await expect(button(p, 'Step')).toBeEnabled();
}
async function step(p: Page, n: number) {
  await button(p, 'Step').click();
  await expect(updates(p)).toHaveText(String(n));
}
async function layout(p: Page) {
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
}
function errors(p: Page) {
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
async function lattice(p: Page) {
  await p.getByRole('link', { name: 'Lattice Systems', exact: true }).click();
  await p
    .getByLabel('Lattice physical system', { exact: true })
    .selectOption('xy');
  await expect(button(p, 'Step')).toBeEnabled();
  await settings(p);
}

test('XY catalog, signed small references, conditional density and legacy return', async ({
  page,
}, info) => {
  const error = errors(page);
  await open(page);
  await expect(
    page.getByLabel('Named example', { exact: true }).locator('option'),
  ).toHaveCount(32);
  await show(page, 'reference');
  await expect(feature(page)).toContainText('Z=1.1263');
  await expect(feature(page)).toContainText('0.3302');
  await show(page, 'conditional');
  await expect(feature(page).getByTestId('xy-conditional')).toContainText(
    'R=0.7',
  );
  await expect(feature(page)).toContainText(
    'not the equilibrium site marginal',
  );
  await root(page).getByLabel('XY source h', { exact: true }).fill('-.7');
  await apply(page);
  await show(page, 'reference');
  await expect(feature(page)).toContainText('-0.3302');
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('xy-dimer');
  await expect(button(page, 'Step')).toBeEnabled();
  await settings(page);
  await show(page, 'reference');
  await expect(feature(page)).toContainText('0.3302');
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('xy-triangle');
  await expect(button(page, 'Step')).toBeEnabled();
  await show(page, 'reference');
  await expect(feature(page).getByTestId('xy-frustration')).toContainText(
    '120°',
  );
  await show(page, 'vortices');
  await expect(feature(page)).toContainText('No declared oriented plaquette');
  await show(page, 'configuration');
  await layout(page);
  for (const example of ['potts-fk-torus', 'u1-square', 'gauge-square']) {
    await page
      .getByLabel('Named example', { exact: true })
      .selectOption(example);
    await expect(
      page.getByRole('button', { name: 'Step', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Step', exact: true }).click();
  }
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('xy-torus');
  await expect(button(page, 'Step')).toBeEnabled();
  await expect(feature(page)).toContainText(
    '8 physical bonds · 4 oriented plaquettes',
  );
  await expect(
    feature(page).getByLabel('XY selected bond').locator('option'),
  ).toHaveCount(8);
  await feature(page).getByLabel('XY selected bond').selectOption('e6');
  await expect(feature(page).getByTestId('xy-bond')).toContainText('Bond e6');
  await step(page, 1);
  await settings(page);
  await root(page).getByText('XY settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5e-small-${info.project.name}.png`,
    fullPage: true,
  });
  await layout(page);
  expect(error).toEqual([]);
});

test('XY positive/negative fixtures, antipodal-safe face orientation and periodic neutrality', async ({
  page,
}) => {
  const error = errors(page);
  await open(page, 'xy-torus');
  await root(page).getByLabel('XY graph geometry').selectOption('square');
  await root(page).getByLabel('XY initialization').selectOption('vortex');
  await apply(page);
  await show(page, 'vortices');
  await expect(feature(page).getByTestId('xy-vortices')).toContainText(
    'positive 1, negative 0',
  );
  await expect(feature(page)).toContainText('charge=1');
  await root(page).getByLabel('XY initialization').selectOption('antivortex');
  await apply(page);
  await expect(feature(page)).toContainText('charge=-1');
  await root(page).getByLabel('XY graph geometry').selectOption('torus');
  await root(page).getByLabel('XY initialization').selectOption('vortex');
  await apply(page);
  await expect(feature(page).getByTestId('xy-vortices')).toContainText(
    'positive 2, negative 2',
  );
  await expect(feature(page)).toContainText('charge sum 0');
  await show(page, 'configuration');
  await expect(
    feature(page).getByRole('button', { name: /Select XY plaquette/ }),
  ).toHaveCount(4);
  await show(page, 'reference');
  await expect(feature(page)).toContainText('Z=7.0694');
  await expect(feature(page)).toContainText('character-sum');
  await layout(page);
  expect(error).toEqual([]);
});

test('XY sampler budgets, display replay, feature exchange and global-rotation worker invariants', async ({
  page,
}) => {
  const error = errors(page);
  await open(page, 'xy-torus');
  await root(page).getByLabel('XY warm-up sweeps').fill('0');
  await root(page)
    .getByLabel('XY sampler', { exact: true })
    .selectOption('metropolis');
  await apply(page);
  await step(page, 1);
  await show(page, 'transition');
  const trace = await feature(page).getByTestId('xy-transition').innerText();
  await expect(feature(page)).toContainText('3 uniforms');
  await button(page, 'Reset').click();
  await expect(updates(page)).toHaveText('0');
  for (const tool of [
    'configuration',
    'conditional',
    'reference',
    'measurements',
    'correlation',
    'history',
    'vortices',
  ])
    await show(page, tool);
  await root(page)
    .getByRole('button', {
      name: 'XY finite-volume reference: Feature',
      exact: true,
    })
    .click();
  for (let i = 0; i < 4; i++) await button(page, 'Add tool').click();
  await expect(button(page, 'Add tool')).toBeDisabled();
  await step(page, 1);
  await show(page, 'transition');
  expect(await feature(page).getByTestId('xy-transition').innerText()).toBe(
    trace,
  );
  await step(page, 2);
  await step(page, 3);
  await step(page, 4);
  await expect(root(page).getByTestId('xy-samples')).toHaveText('1');
  const draws = await root(page).getByTestId('xy-draws').innerText(),
    segment = await root(page).getByTestId('xy-segment').innerText();
  await show(page, 'rotation');
  await feature(page).getByLabel('Preview XY rotation').check();
  await feature(page).getByLabel('Global XY rotation α').fill('1.2');
  await expect(updates(page)).toHaveText('4');
  await feature(page)
    .getByRole('button', { name: 'Apply global XY rotation', exact: true })
    .click();
  await expect(button(page, 'Step')).toBeEnabled();
  await expect(updates(page)).toHaveText('4');
  await expect(root(page).getByTestId('xy-draws')).toHaveText(draws);
  await expect(root(page).getByTestId('xy-segment')).toHaveText(segment);
  await expect(root(page).getByTestId('xy-samples')).toHaveText('1');
  await show(page, 'transition');
  await expect(feature(page)).toContainText('global-rotation event');
  await root(page)
    .getByLabel('XY sampler', { exact: true })
    .selectOption('heat-bath');
  await apply(page);
  await step(page, 5);
  await expect(feature(page)).toContainText('resampled');
  await expect(feature(page)).toContainText('Acceptance rate: N/A');
  await root(page).getByLabel('XY source h', { exact: true }).fill('.1');
  await apply(page);
  await show(page, 'rotation');
  await expect(
    feature(page).getByRole('button', {
      name: 'Apply global XY rotation',
      exact: true,
    }),
  ).toBeDisabled();
  await expect(feature(page)).toContainText('h≠0 breaks');
  await layout(page);
  expect(error).toEqual([]);
});

test('independent XY sessions, 2D boundaries, selectors, old workspaces and mobile layout', async ({
  page,
}, info) => {
  const error = errors(page);
  await open(page, 'xy-dimer');
  await step(page, 1);
  await lattice(page);
  await root(page).getByLabel('XY Lx', { exact: true }).fill('2');
  await root(page).getByLabel('XY Ly', { exact: true }).fill('2');
  await root(page).getByLabel('XY warm-up sweeps').fill('0');
  for (const [x, y, bonds, faces] of [
    ['open', 'open', 4, 1],
    ['periodic', 'open', 6, 2],
    ['open', 'periodic', 6, 2],
    ['periodic', 'periodic', 8, 4],
  ] as const) {
    await root(page).getByLabel('XY x boundary').selectOption(x);
    await root(page).getByLabel('XY y boundary').selectOption(y);
    await apply(page);
    await expect(feature(page)).toContainText(
      `${bonds} physical bonds · ${faces} oriented plaquettes`,
    );
  }
  await feature(page).getByLabel('XY site x', { exact: true }).fill('1');
  await feature(page).getByLabel('XY site y', { exact: true }).fill('1');
  await expect(feature(page).getByTestId('xy-selected')).toContainText(
    'Site 3',
  );
  await step(page, 1);
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await expect(updates(page)).toHaveText('1');
  await step(page, 2);
  await page
    .getByRole('link', { name: 'Lattice Systems', exact: true })
    .click();
  await expect(updates(page)).toHaveText('1');
  await show(page, 'correlation');
  await feature(page).getByLabel('XY correlation direction').selectOption('1');
  await expect(feature(page)).toContainText('Raw spin dot products');
  await show(page, 'configuration');
  for (const system of ['2d', 'chain', 'potts', 'xy']) {
    await page
      .getByLabel('Lattice physical system', { exact: true })
      .selectOption(system);
    await expect(
      page.getByRole('button', { name: 'Step', exact: true }),
    ).toBeEnabled();
  }
  await expect(updates(page)).toHaveText('1');
  await settings(page);
  for (const [lx, ly] of [
    [2, 32],
    [32, 2],
  ]) {
    await root(page).getByLabel('XY Lx', { exact: true }).fill(String(lx));
    await root(page).getByLabel('XY Ly', { exact: true }).fill(String(ly));
    await apply(page);
    const canvas = feature(page).getByTestId('xy-canvas');
    await expect(canvas).toHaveAttribute(
      'aria-label',
      `${lx} by ${ly} XY spin arrows; use site and plaquette selectors`,
    );
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(642);
    expect(box.height).toBeLessThanOrEqual(642);
    expect(box.width / box.height).toBeCloseTo((lx! + 1) / (ly! + 1), 2);
    // The CSS box remains the actual drawing box, so pointer hit testing keeps
    // the same row-major mapping after either dimension is constrained.
    await canvas.click({
      position: {
        x: (box.width * lx!) / (lx! + 1),
        y: (box.height * ly!) / (ly! + 1),
      },
    });
    await expect(feature(page).getByTestId('xy-selected')).toContainText(
      `Site ${lx! * ly! - 1}`,
    );
    await layout(page);
  }
  await root(page).getByLabel('XY Lx', { exact: true }).fill('16');
  await root(page).getByLabel('XY Ly', { exact: true }).fill('16');
  await apply(page);
  await button(page, 'Run').click();
  await expect
    .poll(async () =>
      Number(await root(page).getByTestId('xy-samples').textContent()),
    )
    .toBeGreaterThan(0);
  await button(page, 'Pause').click();
  await expect(button(page, 'Step')).toBeEnabled();
  await root(page).getByText('XY settings', { exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/m5e-lattice-${info.project.name}.png`,
    fullPage: true,
  });
  const overview = button(page, 'Compact overview');
  if (await overview.isVisible()) await overview.click();
  await layout(page);
  for (const destination of ['Lattice QM', 'Lattice Fields', 'Experiments'])
    await page.getByRole('link', { name: destination, exact: true }).click();
  expect(error).toEqual([]);
});
for (const size of [8, 16, 32])
  for (const sampler of ['metropolis', 'heat-bath'])
    test(`XY ${size}×${size} ${sampler}: Run/render/Pause and overlay cost`, async ({
      page,
    }, info) => {
      const error = errors(page);
      await page.goto('./#lattice-systems');
      await page
        .getByLabel('Lattice physical system', { exact: true })
        .selectOption('xy');
      await expect(button(page, 'Step')).toBeEnabled();
      await settings(page);
      await root(page).getByLabel('XY Lx', { exact: true }).fill(String(size));
      await root(page).getByLabel('XY Ly', { exact: true }).fill(String(size));
      await root(page).getByLabel('XY warm-up sweeps').fill('0');
      await root(page)
        .getByLabel('XY sampler', { exact: true })
        .selectOption(sampler);
      await root(page)
        .getByLabel('XY Kx', { exact: true })
        .fill(size === 32 ? '2' : size === 16 ? '1.1' : '.7');
      await root(page)
        .getByLabel('XY Ky', { exact: true })
        .fill(size === 32 ? '2' : size === 16 ? '1.1' : '.7');
      await apply(page);
      for (const overlay of [false, true]) {
        const toggleStart = Date.now();
        await feature(page)
          .getByLabel('Show XY vortex overlay')
          .setChecked(overlay);
        await page.evaluate(
          () =>
            new Promise<void>((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r())),
            ),
        );
        const overlayMs = Date.now() - toggleStart;
        const before = Number(await updates(page).textContent()),
          start = Date.now();
        await button(page, 'Run').click();
        await expect
          .poll(async () => Number(await updates(page).textContent()))
          .toBeGreaterThan(before + size * size);
        await button(page, 'Pause').click();
        await expect(button(page, 'Step')).toBeEnabled();
        const elapsed = Date.now() - start;
        console.info(
          `M5e ${info.project.name} ${size}x${size} ${sampler} overlay=${overlay} toggle/render=${overlayMs}ms run/render/acknowledged-pause=${elapsed}ms`,
        );
        expect(elapsed).toBeLessThan(10000);
      }
      await feature(page)
        .getByLabel('XY selected site', { exact: true })
        .fill(String(size * size - 1));
      await feature(page)
        .getByLabel('XY selected plaquette', { exact: true })
        .fill(String(size * size - 1));
      await expect(feature(page).getByTestId('xy-selected')).toContainText(
        `Site ${size * size - 1}`,
      );
      await layout(page);
      expect(error).toEqual([]);
    });

test('hidden XY keeps its running session until explicit acknowledged Pause', async ({
  page,
}) => {
  await open(page, 'xy-dimer');
  await button(page, 'Run').click();
  await expect
    .poll(async () => Number(await updates(page).textContent()))
    .toBeGreaterThan(0);
  const small = page.getByTestId('small-xy-workspace');
  const before = Number(await small.getByTestId('xy-updates').textContent());
  await page.getByRole('link', { name: 'Experiments', exact: true }).click();
  await expect(small).not.toBeVisible();
  await expect
    .poll(async () =>
      Number(await small.getByTestId('xy-updates').textContent()),
    )
    .toBeGreaterThan(before);
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await button(page, 'Pause').click();
  await expect(button(page, 'Step')).toBeEnabled();
  const paused = Number(await updates(page).textContent());
  await page.getByRole('link', { name: 'Experiments', exact: true }).click();
  await page.getByRole('link', { name: 'Small Systems', exact: true }).click();
  await expect(updates(page)).toHaveText(String(paused));
});
