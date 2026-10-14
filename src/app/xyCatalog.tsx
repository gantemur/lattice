import { defaultSmallXY } from '../engine/xyRun';
import type { XYConfiguration } from '../engine/xyRun';
import { xyGraph } from '../domain/xyDomain';
export const xyExamples = [
  ['xy-rotor', 'Single planar rotor in a field'],
  ['xy-dimer', 'Coupled XY rotor pair'],
  ['xy-triangle', 'Frustrated XY triangle'],
  ['xy-torus', 'XY periodic 2×2 torus'],
] as const;
export type XYExampleId = (typeof xyExamples)[number][0];
export function isXYExample(id: string): id is XYExampleId {
  return xyExamples.some(([key]) => key === id);
}
export function xyRecipe(id: XYExampleId): XYConfiguration {
  return {
    ...defaultSmallXY,
    initialization: id === 'xy-rotor' ? 'aligned' : 'random',
    parameters: {
      h: id === 'xy-rotor' ? 0.7 : 0,
      geometry: xyGraph(
        id === 'xy-rotor'
          ? 'site'
          : id === 'xy-dimer'
            ? 'dimer'
            : id === 'xy-triangle'
              ? 'triangle'
              : 'torus',
        id === 'xy-triangle' ? -1 : 0.7,
      ),
    },
  };
}
export function XYCatalogOptions() {
  return (
    <optgroup label="Small XY systems">
      {xyExamples.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </optgroup>
  );
}
