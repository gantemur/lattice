import { graphPreset, validateDomain } from './graph';
import type { Domain, Face } from './graph';

export type GaugeGeometry = 'square' | 'torus';
export type GaugeLoop = {
  id: string;
  label: string;
  boundary: Face['boundary'];
  winding: boolean;
};
/** A signed walk retains orientation for future link groups even though U^-1=U in Z₂. */
export function validateGaugeLoop(
  domain: Domain,
  boundary: Face['boundary'],
): void {
  validateDomain({ ...domain, faces: [{ id: 'loop', boundary }] });
}

/** Only the two declared cell complexes are supported; no inferred faces. */
export function gaugeGeometry(geometry: GaugeGeometry) {
  if (!['square', 'torus'].includes(geometry))
    throw new Error('Use square or torus geometry.');
  const domain = graphPreset(geometry);
  validateDomain(domain);
  const loops: GaugeLoop[] = domain.faces.map((f) => ({
    ...f,
    label: `Plaquette ${f.id}`,
    winding: false,
  }));
  if (geometry === 'torus') {
    const walk = (edges: [string, 1 | -1][]) =>
      edges.map(([edgeId, sign]) => ({ edgeId, sign }));
    loops.push(
      // The lifted 2×1 rectangle is contractible. Its projection touches itself:
      // e1 occurs twice in opposite directions, leaving P_f0 P_f1. The two-face
      // union wraps x; its reduced boundary alone has two connected components.
      {
        id: 'pair',
        label: 'Two-face contractible walk (f0 × f1)',
        winding: false,
        boundary: walk([
          ['e0', 1],
          ['e2', 1],
          ['e1', 1],
          ['e6', -1],
          ['e4', -1],
          ['e1', -1],
        ]),
      },
      {
        id: 'wx',
        label: 'Horizontal winding Wₓ',
        winding: true,
        boundary: walk([
          ['e0', 1],
          ['e2', 1],
        ]),
      },
      {
        id: 'wy',
        label: 'Vertical winding Wᵧ',
        winding: true,
        boundary: walk([
          ['e1', 1],
          ['e5', 1],
        ]),
      },
    );
  }
  loops.forEach((loop) => validateGaugeLoop(domain, loop.boundary));
  return {
    geometry,
    domain,
    edgeIndex: new Map(domain.edges.map((e, i) => [e.id, i])),
    loops,
  };
}
