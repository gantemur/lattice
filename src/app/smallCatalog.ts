import { customIsingModel, isingPreset } from '../models/ising';
import { scalarPreset } from '../models/scalarField';
import { defaultModel } from '../models/singleVariable';
import type { Model } from '../models/singleVariable';
import type { Sampler } from '../algorithms/transitions';
import type { IsingGraphPreset } from '../domain/graph';
import type { ScalarPreset } from '../models/scalarField';
import { customPairIds } from '../domain/graph';

/** A recipe is presentation metadata. It never enters worker or archive data. */
export const catalogGroups = [
  {
    label: 'Elementary probability',
    examples: [
      ['gaussian', '0D Gaussian', 'A continuous normal distribution.'],
      ['spin', 'Single Ising spin', 'One spin in an external field.'],
      ['binomial', 'Binomial count', 'A count of independent successes.'],
    ],
  },
  {
    label: 'Small Ising graphs',
    examples: [
      ['ising-dimer', 'Two-spin dimer', 'One ferromagnetic bond.'],
      [
        'ising-chain3',
        'Three-spin open chain',
        'Correlations along two bonds.',
      ],
      ['ising-triangle', 'Three-spin triangle', 'A closed, three-bond graph.'],
      [
        'ising-antiferro-triangle',
        'Frustrated antiferromagnetic triangle',
        'Three negative bonds on an odd cycle cannot all be satisfied; six spin configurations minimize the action.',
      ],
      ['ising', 'Four-spin periodic ring', 'A one-dimensional periodic chain.'],
      ['ising-star', 'Four-spin star', 'One site has three neighbors.'],
      [
        'ising-square',
        'Open 2×2 Ising square',
        'Four bonds and one oriented face.',
      ],
    ],
  },
  {
    label: 'Continuous small systems',
    examples: [
      [
        'scalar',
        'Coupled Gaussian pair',
        'Two real variables with an analytic joint reference.',
      ],
      [
        'scalar-double-well',
        'Symmetric quartic double well',
        'A classical Gibbs potential with two wells.',
      ],
      [
        'scalar-tilted-well',
        'Tilted quartic double well',
        'An external source favors one well.',
      ],
      [
        'scalar-four-gaussian',
        'Four coupled Gaussian variables',
        'A Gaussian graph with analytic covariance.',
      ],
      [
        'scalar-four-quartic',
        'Four coupled quartic variables',
        'An interacting graph with sampled marginals.',
      ],
    ],
  },
  {
    label: 'Advanced examples',
    examples: [
      [
        'ising-custom',
        'Custom Ising graph (2–4 spins)',
        'Choose each simple edge independently from its signed coupling.',
      ],
      [
        'scalar-baseline',
        'One-site Gaussian scalar',
        'A real-scalar view of one Gaussian variable.',
      ],
      ['ising-path', 'Four-spin open chain', 'A longer open graph.'],
      [
        'ising-complete',
        'Complete graph K4',
        'All six pairwise interactions are adjustable.',
      ],
      [
        'ising-torus',
        'Periodic 2×2 torus',
        'Eight distinct bonds and four oriented faces.',
      ],
    ],
  },
] as const;

type CatalogEntry = (typeof catalogGroups)[number] extends infer Group
  ? Group extends { examples: readonly (infer Entry)[] }
    ? Entry
    : never
  : never;
export type ExampleId = CatalogEntry[0];
export const examples: readonly (readonly [ExampleId, string, string])[] =
  catalogGroups.flatMap<CatalogEntry>((group) => group.examples);

const scalarRecipes = {
  scalar: 'pair',
  'scalar-baseline': 'baseline',
  'scalar-double-well': 'double-well',
  'scalar-tilted-well': 'tilted-well',
  'scalar-four-gaussian': 'four-gaussian',
  'scalar-four-quartic': 'four-quartic',
} as const satisfies Record<string, ScalarPreset>;

const isingRecipes = {
  ising: 'ring',
  'ising-dimer': 'dimer',
  'ising-chain3': 'chain3',
  'ising-triangle': 'triangle',
  'ising-antiferro-triangle': 'triangle',
  'ising-star': 'star',
  'ising-square': 'square',
  'ising-path': 'path',
  'ising-complete': 'complete',
  'ising-torus': 'torus',
} as const satisfies Record<string, IsingGraphPreset>;

export function exampleConfiguration(id: ExampleId): {
  model: Model;
  sampler: Sampler;
} {
  if (id === 'gaussian' || id === 'spin' || id === 'binomial')
    return { model: defaultModel(id), sampler: { kind: 'direct' } };
  if (id === 'ising-custom')
    return {
      model: customIsingModel(
        4,
        customPairIds(4).filter((pair) =>
          ['pair:v0:v1', 'pair:v1:v2', 'pair:v2:v3'].includes(pair),
        ),
      ),
      sampler: { kind: 'direct' },
    };
  if (Object.hasOwn(scalarRecipes, id)) {
    const preset = scalarRecipes[id as keyof typeof scalarRecipes];
    const quartic = preset.includes('well') || preset === 'four-quartic';
    return {
      model: scalarPreset(preset),
      sampler: quartic
        ? { kind: 'metropolis', width: 1, warmup: 200 }
        : { kind: 'direct' },
    };
  }
  if (!Object.hasOwn(isingRecipes, id)) throw new Error('Unknown example.');
  const model = isingPreset(isingRecipes[id as keyof typeof isingRecipes]);
  if (id === 'ising-antiferro-triangle')
    for (const edge of model.parameters.domain.edges)
      model.parameters.couplings[edge.id] = -1;
  return { model, sampler: { kind: 'direct' } };
}

export function matchingExample(model: Model): ExampleId | null {
  return (
    examples.find(
      ([id]) =>
        JSON.stringify(exampleConfiguration(id).model) ===
        JSON.stringify(model),
    )?.[0] ?? null
  );
}
