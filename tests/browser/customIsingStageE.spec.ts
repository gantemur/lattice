import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const choose = async (page: Page) => {
  await page.goto('./#small-systems');
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('ising-custom');
  await expect(
    page.getByRole('heading', { name: 'Custom Ising graph' }),
  ).toBeVisible();
};
const openEditor = async (page: Page) => {
  if (
    !(await page
      .locator('#graph-parameter-editor')
      .evaluate((element) => element.hasAttribute('open')))
  )
    await page
      .getByText('Custom graph & numerical parameters', { exact: true })
      .click();
};
const apply = (page: Page) =>
  page.getByRole('button', { name: 'Apply custom graph' }).click();
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const capture = async (page: Page, name: string, project: string) => {
  if (project !== 'mobile-webkit')
    await page.screenshot({
      path: `docs/screenshots/custom-ising-stage-e-${name}-${project}.png`,
      fullPage: true,
    });
};

test('advanced custom graph has explicit draft edges, stable IDs and three site counts', async ({
  page,
}, info) => {
  await choose(page);
  await expect(
    page
      .getByLabel('Named example', { exact: true })
      .locator(
        'optgroup[label="Advanced examples"] option[value="ising-custom"]',
      ),
  ).toHaveCount(1);
  await expect(page.getByText('4 sites · 3 bonds · 0 faces')).toBeVisible();
  await expect(page.locator('.graph-edge')).toHaveCount(3);
  await openEditor(page);
  await expect(page.getByLabel('Number of spins')).toHaveValue('4');
  await expect(page.getByLabel('Present v0–v1')).toBeChecked();
  await expect(page.getByLabel('Present v0–v2')).not.toBeChecked();
  await capture(page, 'four-chain', info.project.name);

  // A draft diagonal does not change the featured scientific graph.
  await page.getByLabel('Present v0–v2').check();
  await page.getByLabel('Coupling pair:v0:v2').fill('-0.6');
  await expect(page.locator('.graph-edge')).toHaveCount(3);
  await expect(
    page.getByText('Draft: 4 sites · 4 present bonds'),
  ).toBeVisible();
  await capture(page, 'draft-applied', info.project.name);
  await apply(page);
  await expect(page.getByTestId('total-updates')).toHaveText('0');
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 1');
  await expect(page.locator('.graph-edge')).toHaveCount(4);
  await expect(
    page.getByRole('button', { name: /Select bond pair:v0:v2/ }),
  ).toBeVisible();
  await expect(page.getByTestId('example-description')).toContainText(
    'modified',
  );
  await capture(page, 'four-diagonal', info.project.name);

  await openEditor(page);
  await page.getByLabel('Number of spins').selectOption('3');
  await page.getByLabel('Present v0–v2').check();
  await apply(page);
  await expect(page.getByText('3 sites · 3 bonds · 0 faces')).toBeVisible();
  await expect(page.locator('.graph-edge')).toHaveCount(3);
  await capture(page, 'triangle', info.project.name);
  await openEditor(page);
  await page.getByLabel('Number of spins').selectOption('2');
  await apply(page);
  await expect(page.getByText('2 sites · 1 bond · 0 faces')).toBeVisible();
  await expect(page.getByLabel('Selected site', { exact: true })).toHaveValue(
    'v0',
  );
  await expect(page.getByLabel('Selected bond')).toHaveValue('pair:v0:v1');
  await capture(page, 'dimer', info.project.name);
  expect(await noOverflow(page)).toBe(true);
});

test('zero-weight presence, absent pairs, disconnection and selection are distinct', async ({
  page,
}, info) => {
  await choose(page);
  await openEditor(page);
  await page.getByLabel('Present v0–v1').uncheck();
  await expect(page.getByLabel('Coupling pair:v0:v1')).toHaveValue('0.5');
  await page.getByLabel('Present v0–v1').check();
  await page.getByLabel('Coupling pair:v0:v1').fill('0');
  await apply(page);
  await expect(page.locator('.graph-edge.zero-weight')).toHaveCount(1);
  await expect(page.getByLabel('Selected bond')).toHaveValue('pair:v0:v1');
  await capture(page, 'zero-bond', info.project.name);

  await page.getByRole('button', { name: /Select bond pair:v2:v3/ }).click();
  await expect(page.getByLabel('Selected bond')).toHaveValue('pair:v2:v3');
  await openEditor(page);
  await page.getByLabel('Present v0–v1').uncheck();
  await page.getByLabel('Present v1–v2').uncheck();
  await page.getByLabel('Present v2–v3').uncheck();
  await apply(page);
  await expect(page.locator('.graph-edge')).toHaveCount(0);
  await expect(page.getByText('4 sites · 0 bonds · 0 faces')).toBeVisible();
  await expect(page.getByLabel('Selected bond')).toHaveValue('');
  await expect(page.getByLabel('Selected bond')).toContainText('No bonds');
  await capture(page, 'disconnected', info.project.name);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('sample-count')).toHaveText('1');
  await page
    .getByText('Exact references & diagnostics', { exact: true })
    .click();
  await expect(page.getByText('log Z = 2.7726')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test('parameter Apply isolates a segment without reseeding; tools and exact inspection stay usable', async ({
  page,
}, info) => {
  await choose(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const configuration = await page
    .getByTestId('spin-configuration')
    .textContent();
  await openEditor(page);
  await page.getByLabel('Coupling pair:v0:v1').fill('-1.25');
  await page.getByLabel('Field v0').fill('0.75');
  await expect(page.locator('.graph-edge.negative-weight')).toHaveCount(0);
  await apply(page);
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await expect(page.getByTestId('total-updates')).toHaveText('1');
  await expect(page.getByTestId('sample-count')).toHaveText('0');
  await expect(page.getByTestId('spin-configuration')).toHaveText(
    configuration!,
  );
  await expect(page.locator('.graph-edge.negative-weight')).toHaveCount(1);
  await page.getByRole('button', { name: /Select bond pair:v0:v1/ }).click();
  await page.getByText('Local graph inspection', { exact: true }).click();
  await page.getByTestId('selected-bond-panel').locator('summary').click();
  await expect(page.getByTestId('selected-bond-panel')).toContainText(
    'K = -1.25',
  );
  await page.getByRole('button', { name: 'Edit coupling pair:v0:v1' }).click();
  await expect(page.getByLabel('Coupling pair:v0:v1')).toBeFocused();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByTestId('selected-site-panel').locator('summary').click();
  await expect(page.getByTestId('selected-site-panel')).toContainText('P(+1');
  await page
    .getByText('Exact references & diagnostics', { exact: true })
    .click();
  await expect(
    page.getByText('Exact configuration probabilities', { exact: false }),
  ).toBeVisible();
  const tools = page.getByRole('region', { name: 'Small Systems tools' });
  await tools.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(tools.getByLabel('Tool 3 type')).toBeVisible();
  await tools.getByLabel('Tool 3 type').selectOption('conditional');
  await tools
    .getByRole('button', { name: /Feature/ })
    .last()
    .click();
  await expect(page.getByTestId('total-updates')).toHaveText('2');
  await capture(page, 'negative-inspection', info.project.name);
  expect(await noOverflow(page)).toBe(true);
});

test('custom capture records only active interactions and survives JSON import', async ({
  page,
}) => {
  await choose(page);
  await openEditor(page);
  await page.getByLabel('Present v0–v2').check();
  await page.getByLabel('Coupling pair:v0:v2').fill('0');
  await page.getByLabel('Present v1–v2').uncheck();
  await apply(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByRole('button', { name: 'Save current segment' }).click();
  await page.goto('./#experiments');
  const name = await page.getByLabel('Saved record name').inputValue();
  await page.getByRole('checkbox', { name: `Select ${name}` }).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download selected JSON bundle' }).click(),
  ]);
  const path = await download.path();
  const bundle = JSON.parse(await readFile(path!, 'utf8'));
  const saved = bundle.records[0].scientific.capture.segment.model.parameters;
  expect(saved.domain.id).toBe('custom-simple-ising');
  expect(saved.domain.edges.map((edge: { id: string }) => edge.id)).toEqual([
    'pair:v0:v1',
    'pair:v0:v2',
    'pair:v2:v3',
  ]);
  expect(saved.couplings['pair:v0:v2']).toBe(0);
  expect(saved.couplings['pair:v1:v2']).toBeUndefined();
  expect(JSON.stringify(bundle)).not.toContain('ising-custom');
  await page.reload();
  await page.getByLabel('Import experiment JSON').setInputFiles(path!);
  await expect(page.getByTestId('archive-detail')).toContainText(
    '1 full-segment measurements',
  );
});

test('all six pair choices remain independent; named graphs and torus retain their topology', async ({
  page,
}) => {
  await choose(page);
  await openEditor(page);
  for (const pair of ['v0–v1', 'v0–v2', 'v0–v3', 'v1–v2', 'v1–v3', 'v2–v3'])
    await page.getByLabel(`Present ${pair}`).check();
  await apply(page);
  await expect(page.locator('.graph-edge')).toHaveCount(6);
  for (const id of [
    'pair:v0:v1',
    'pair:v0:v2',
    'pair:v0:v3',
    'pair:v1:v2',
    'pair:v1:v3',
    'pair:v2:v3',
  ])
    await expect(
      page.getByRole('button', { name: new RegExp(`Select bond ${id},`) }),
    ).toBeVisible();
  await openEditor(page);
  await page.getByLabel('Present v0–v2').uncheck();
  await apply(page);
  await expect(page.locator('.graph-edge')).toHaveCount(5);
  await expect(
    page.getByRole('button', { name: /Select bond pair:v0:v2,/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Select bond pair:v0:v3,/ }),
  ).toBeVisible();
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('ising-triangle');
  await expect(page.locator('.graph-edge')).toHaveCount(3);
  await expect(
    page.getByText('Geometry & numerical parameters', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('ising-torus');
  await expect(page.getByText('4 sites · 8 bonds · 4 faces')).toBeVisible();
  await page
    .getByLabel('Named example', { exact: true })
    .selectOption('ising-custom');
  await expect(page.locator('.graph-edge')).toHaveCount(3);
  await expect(page.getByTestId('example-description')).not.toContainText(
    'modified',
  );
});

test('display-only graph and tool choices replay the same seeded custom capture', async ({
  page,
  context,
}) => {
  await choose(page);
  const control = await context.newPage();
  await choose(control);
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await control.getByRole('button', { name: 'Step', exact: true }).click();
  }
  const tools = page.getByRole('region', { name: 'Small Systems tools' });
  await page.getByRole('button', { name: /Select vertex v3,/ }).click();
  await page.getByRole('button', { name: /Select bond pair:v1:v2,/ }).click();
  await tools.getByRole('button', { name: 'Refit axes' }).click();
  await tools.getByRole('button', { name: 'Add tool', exact: true }).click();
  await tools.getByLabel('Tool 3 type').selectOption('acceptance');
  await tools
    .getByRole('button', { name: /Acceptance diagnostics: Feature/ })
    .click();
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await control.getByRole('button', { name: 'Step', exact: true }).click();
  }
  const savedCapture = async (target: Page) => {
    await target.getByRole('button', { name: 'Save current segment' }).click();
    await target.goto('./#experiments');
    const name = await target.getByLabel('Saved record name').inputValue();
    await target.getByRole('checkbox', { name: `Select ${name}` }).check();
    const [download] = await Promise.all([
      target.waitForEvent('download'),
      target
        .getByRole('button', { name: 'Download selected JSON bundle' })
        .click(),
    ]);
    const bundle = JSON.parse(await readFile((await download.path())!, 'utf8'));
    return bundle.records[0].scientific.capture;
  };
  expect(await savedCapture(page)).toEqual(await savedCapture(control));
  await control.close();
});

test('custom graphs use existing heat-bath and Metropolis controls, including Run/Pause', async ({
  page,
}) => {
  await choose(page);
  await page.getByText('Model & sampler settings', { exact: true }).click();
  await page.getByLabel('Sampling algorithm').selectOption('heat-bath');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 2');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByText(/Local heat-bath resample/)).toBeVisible();
  await page.getByLabel('Sampling algorithm').selectOption('metropolis');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.getByTestId('active-segment')).toHaveText('Segment 3');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByTestId('transition-details')).toContainText(
    'Accept probability',
  );
  await page.getByRole('button', { name: '▷ Run' }).click();
  await expect(page.getByTestId('run-status')).toHaveText('Sampling');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByTestId('run-status')).toHaveText('Paused');
  expect(
    Number(await page.getByTestId('total-updates').textContent()),
  ).toBeGreaterThan(2);
  expect(await noOverflow(page)).toBe(true);
});
