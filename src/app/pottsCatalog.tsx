import { defaultSmallPotts } from '../engine/pottsRun';
import type { PottsConfiguration } from '../engine/pottsRun';
import { pottsGraph } from '../domain/pottsDomain';
export const pottsExamples = [
  ['potts-dimer', 'Potts dimer'],
  ['potts-triangle', 'Antiferromagnetic Potts triangle'],
  ['potts-fk-torus', 'FK clusters and Potts colors'],
  ['potts-torus', 'Potts periodic 2×2 torus'],
] as const;
export type PottsExampleId = (typeof pottsExamples)[number][0];
export function isPottsExample(id: string): id is PottsExampleId {
  return pottsExamples.some(([key]) => key === id);
}
export function pottsRecipe(id: PottsExampleId): PottsConfiguration {
  return {
    ...defaultSmallPotts,
    sampler: id === 'potts-fk-torus' ? 'fk-direct' : 'direct',
    parameters: {
      q: 3,
      h: 0,
      geometry: pottsGraph(
        id === 'potts-dimer'
          ? 'dimer'
          : id === 'potts-triangle'
            ? 'triangle'
            : 'torus',
        id === 'potts-triangle' ? -1 : 0.7,
      ),
    },
  };
}
export function PottsCatalogOptions() {
  return (
    <optgroup label="Small Potts systems">
      {pottsExamples.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </optgroup>
  );
}
