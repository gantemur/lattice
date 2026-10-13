import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });
async function open(page: Page) {
  await page.goto('./#lattice-systems');
  await page.getByLabel('Lattice physical system').selectOption('chain');
  await expect(page.getByRole('heading', { name: /One chain/ })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Spin chain configuration' }),
  ).toBeVisible();
}
async function shot(page: Page, name: string, project: string) {
  if (project !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/ising-chain-${name}-${project}.png`,
      fullPage: true,
    });
}
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('periodic chain, exact comparison, local Run/Step and configurable tools', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page.getByLabel('Chain length N')).toHaveValue('32');
  await expect(page.getByLabel('Chain boundary')).toHaveValue('periodic');
  await expect(
    page
      .getByLabel('Ising chain tools featured tool')
      .locator('option[value="local-neighborhood"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Spin chain configuration' }),
  ).toContainText('closing bond');
  await expect(
    page.getByRole('region', { name: 'Chain spatial correlation comparison' }),
  ).toContainText('exact finite-32');
  await shot(page, 'periodic-32', info.project.name);
  await page.getByLabel('Inspect chain site').fill('31');
  await expect(
    page.getByRole('region', { name: 'Spin chain configuration' }),
  ).toContainText('window 15–31');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Spin chain configuration' }),
  ).toContainText('Latest updated site:');
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(
        (
          await page
            .getByRole('region', {
              name: 'Chain spatial correlation comparison',
            })
            .textContent()
        )?.match(/Teal: (\d+)/)?.[1] ?? 0,
      ),
    )
    .toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await expect(page.getByRole('status').first()).toContainText('Paused');
  await shot(page, 'correlation', info.project.name);
  const retained = await page
    .getByRole('region', { name: 'Chain sampling controls' })
    .textContent();
  await page
    .getByRole('button', {
      name: 'Exact versus sampled spatial correlation: Feature',
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Exact versus sampled spatial correlation',
    }),
  ).toBeVisible();
  await page
    .getByLabel('Ising chain tools featured tool')
    .selectOption('transfer');
  await expect(
    page.getByRole('heading', { name: 'Transfer matrix and eigenvalues' }),
  ).toBeVisible();
  await shot(page, 'transfer', info.project.name);
  await page
    .getByLabel('Ising chain tools featured tool')
    .selectOption('length');
  await expect(page.getByLabel('Bulk correlation length')).toContainText(
    'No finite-temperature phase transition',
  );
  expect(
    await page
      .getByRole('region', { name: 'Chain sampling controls' })
      .textContent(),
  ).toBe(retained);
  expect(await noOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('open ends, low T, AF signs and same-chain parameter segments', async ({
  page,
}, info) => {
  await open(page);
  await page.getByLabel('Chain boundary').selectOption('open');
  await page.getByLabel('Chain length N').fill('2');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(
    page.getByRole('region', { name: 'Spin chain configuration' }),
  ).toContainText('Open chain');
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 1');
  await shot(page, 'open', info.project.name);
  await page.getByLabel('Chain length N').fill('32');
  await page.getByLabel('Chain temperature T').fill('0.2');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page
    .getByLabel('Ising chain tools featured tool')
    .selectOption('length');
  await expect(page.getByLabel('Bulk correlation length')).toContainText(
    'exceeds this finite chain',
  );
  await shot(page, 'low-temperature', info.project.name);
  await page.getByLabel('Chain coupling J').fill('-1');
  await page.getByLabel('Chain temperature T').fill('1');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 2');
  await expect(page.getByLabel('Bulk correlation length')).toContainText(
    'alternating antiferromagnetic',
  );
  await page
    .getByLabel('Ising chain tools featured tool')
    .selectOption('chain-correlation');
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(
        (
          await page
            .getByRole('region', {
              name: 'Chain spatial correlation comparison',
            })
            .first()
            .textContent()
        )?.match(/Teal: (\d+)/)?.[1] ?? 0,
      ),
    )
    .toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await shot(page, 'antiferromagnetic', info.project.name);
  await page.getByLabel('Chain sampler').selectOption('heat-bath');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 3');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('lattice-segment')).toHaveText('Segment 1');
  expect(await noOverflow(page)).toBe(true);
});

test('saved chain captures retain a one-dimensional archive identity', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Chain warm-up sweeps').fill('0');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect
    .poll(async () =>
      Number(
        (
          await page
            .getByRole('region', {
              name: 'Chain spatial correlation comparison',
            })
            .textContent()
        )?.match(/Teal: (\d+)/)?.[1] ?? 0,
      ),
    )
    .toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await expect(page.getByText(/Saved 1 chain segment/)).toBeVisible();
  await page.goto('./#experiments');
  await expect(page.locator('.archive-row')).toHaveCount(1);
  await expect(page.locator('.archive-row')).toContainText('1D Ising chain');
  await expect(page.locator('.archive-row')).toContainText('periodic N=32');
  await expect(page.locator('.archive-row')).not.toContainText('Jy=');
});
