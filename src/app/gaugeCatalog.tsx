/** A presentation launcher, deliberately outside the legacy Model recipe union. */
export const z2Examples = [
  ['gauge-square', 'Z₂ gauge — single plaquette'],
  ['gauge-torus', 'Z₂ gauge — periodic 2×2 torus'],
] as const;
export type GaugeExampleId = (typeof z2Examples)[number][0];
export const u1Examples = [
  ['u1-square', 'Compact U(1) — single plaquette'],
  ['u1-torus', 'Compact U(1) — periodic 2×2 torus'],
] as const;
export type U1ExampleId = (typeof u1Examples)[number][0];
export const gaugeExamples = [...z2Examples, ...u1Examples];
export function isU1Example(id: string): id is U1ExampleId {
  return u1Examples.some(([candidate]) => candidate === id);
}
export function isGaugeExample(id: string): id is GaugeExampleId {
  return z2Examples.some(([candidate]) => candidate === id);
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
