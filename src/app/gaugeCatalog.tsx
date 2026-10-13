/** A presentation launcher, deliberately outside the legacy Model recipe union. */
export const gaugeExamples = [
  ['gauge-square', 'Z₂ gauge — single plaquette'],
  ['gauge-torus', 'Z₂ gauge — periodic 2×2 torus'],
] as const;
export type GaugeExampleId = (typeof gaugeExamples)[number][0];
export function isGaugeExample(id: string): id is GaugeExampleId {
  return gaugeExamples.some(([candidate]) => candidate === id);
}
export function GaugeCatalogOptions() {
  return (
    <optgroup label="Small gauge systems">
      {gaugeExamples.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </optgroup>
  );
}
