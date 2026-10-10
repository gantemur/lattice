import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ModelNotes, ModelFormula } from '../app/ModelNotes';
import { ConvergencePlot } from '../plotting/ConvergencePlot';
import { SimulationRun } from '../engine/simulationEngine';
import { fitSegments } from '../plotting/viewport';
import { defaultModel } from '../models/singleVariable';
it.each(['gaussian', 'spin', 'binomial'] as const)(
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
