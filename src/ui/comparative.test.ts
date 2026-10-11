import { projectSegments } from '../plotting/isingProjection';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ModelNotes, ModelFormula } from '../app/ModelNotes';
import { ConvergencePlot } from '../plotting/ConvergencePlot';
import { SimulationRun } from '../engine/simulationEngine';
import { fitSegments } from '../plotting/viewport';
import { defaultModel } from '../models/singleVariable';
it.each(['gaussian', 'spin', 'binomial', 'ising'] as const)(
  'renders authored %s formulas and explanations without KaTeX errors',
  (kind) => {
    for (const component of [ModelNotes, ModelFormula]) {
      const html = renderToStaticMarkup(
        createElement(component, { model: defaultModel(kind) }),
      );
      expect(html).toContain('katex-mathml');
      expect(html).not.toContain('katex-error');
    }
  },
);
it('never gives Metropolis segments independent Gaussian confidence bands', () => {
  const run = new SimulationRun(1, {
    model: defaultModel('gaussian'),
    sampler: { kind: 'metropolis', width: 2, warmup: 0 },
    seed: 3,
  });
  run.advance(100);
  const segments = run.snapshot().segments;
  const html = renderToStaticMarkup(
    createElement(ConvergencePlot, {
      segments,
      viewport: fitSegments(segments),
      absoluteError: false,
    }),
  );
  expect(html).not.toContain('data-testid="independent-band"');
  run.changeSettings({
    model: defaultModel('gaussian'),
    sampler: { kind: 'direct' },
  });
  run.advance(100);
  const both = run.snapshot().segments;
  const mixed = renderToStaticMarkup(
    createElement(ConvergencePlot, {
      segments: both,
      viewport: fitSegments(both),
      absoluteError: false,
    }),
  );
  expect(mixed.match(/data-testid="independent-band"/g)).toHaveLength(1);
});

it('renders constant graph action distributions and convergence without degenerate axes', () => {
  const model = defaultModel('ising');
  if (model.kind !== 'ising') throw new Error('Wrong fixture');
  for (const id of Object.keys(model.parameters.couplings))
    model.parameters.couplings[id] = 0;
  const run = new SimulationRun(1, {
    model,
    sampler: { kind: 'heat-bath', warmup: 0 },
    seed: 2,
  });
  run.advance(10);
  const segments = projectSegments(run.snapshot().segments, 'E'),
    viewport = fitSegments(segments);
  expect(viewport.mean.max).toBeGreaterThan(viewport.mean.min);
  expect(viewport.error.min).toBeGreaterThan(0);
  for (const absoluteError of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(ConvergencePlot, { segments, viewport, absoluteError }),
    );
    expect(html).not.toMatch(/NaN|Infinity|independent-band/);
  }
});

it('discloses zero and below-range errors, breaking paths and retaining numeric readouts', () => {
  const run = new SimulationRun(1, {
    model: defaultModel('gaussian'),
    sampler: { kind: 'direct' },
    seed: 1,
  });
  run.advance(100);
  const segments = run.snapshot().segments;
  segments[0]!.convergence = [
    { count: 1, mean: 0 },
    { count: 2, mean: 1e-18 },
    { count: 3, mean: 0.1 },
    { count: 100, mean: 0.02 },
  ];
  segments[0]!.moments.mean = 0.02;
  const html = renderToStaticMarkup(
    createElement(ConvergencePlot, {
      segments,
      viewport: fitSegments(segments),
      absoluteError: true,
    }),
  );
  expect(html).toContain('1 zero-error checkpoints omitted');
  expect(html).toContain('1 positive checkpoints below');
  expect(html).toContain('current absolute error:');
  expect(html).toContain('N = 100');
  expect(html).toContain('0.02');
  expect(html).not.toMatch(/NaN|Infinity/);
  segments[0]!.convergence = [{ count: 100, mean: 0 }];
  expect(
    renderToStaticMarkup(
      createElement(ConvergencePlot, {
        segments,
        viewport: fitSegments(segments),
        absoluteError: true,
      }),
    ),
  ).toContain('All recorded errors are zero');
});
