import { graphPreset, validateDomain } from '../domain/graph';
import type { Domain, Face } from '../domain/graph';

export type GaugeGeometry = 'square' | 'torus';
export type GaugeLoop = {
  id: string;
  label: string;
  boundary: Face['boundary'];
  winding: boolean;
};
export type GaugeModel = {
  geometry: GaugeGeometry;
  K: number;
  domain: Domain;
  edgeIndex: ReadonlyMap<string, number>;
  loops: GaugeLoop[];
};

/** A signed walk retains orientation for future link groups even though U^-1=U in Z₂. */
export function validateGaugeLoop(
  domain: Domain,
  boundary: Face['boundary'],
): void {
  validateDomain({ ...domain, faces: [{ id: 'loop', boundary }] });
}

/** Only the two declared cell complexes are supported; no inferred faces. */
export function gaugeModel(geometry: GaugeGeometry, K: number): GaugeModel {
  if (
    !['square', 'torus'].includes(geometry) ||
    !Number.isFinite(K) ||
    Math.abs(K) > 4
  )
    throw new Error('Use square or torus geometry and finite K in [−4, 4].');
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
    K,
    domain,
    edgeIndex: new Map(domain.edges.map((e, i) => [e.id, i])),
    loops,
  };
}
export function validateLinks(
  model: GaugeModel,
  links: readonly number[],
): void {
  if (
    links.length !== model.domain.edges.length ||
    links.some((u) => u !== 1 && u !== -1)
  )
    throw new Error('Supply exactly one ±1 value per physical edge ID.');
}
export function gaugeState(model: GaugeModel, code: number): number[] {
  if (
    !Number.isInteger(code) ||
    code < 0 ||
    code >= 2 ** model.domain.edges.length
  )
    throw new Error('Invalid link word.');
  return model.domain.edges.map((_, i) => (code & (1 << i) ? -1 : 1));
}
export function wilsonProduct(
  model: GaugeModel,
  links: readonly number[],
  boundary: Face['boundary'],
): number {
  validateLinks(model, links);
  validateGaugeLoop(model.domain, boundary);
  return boundary.reduce(
    (p, incidence) => p * links[model.edgeIndex.get(incidence.edgeId)!]!,
    1,
  );
}
export function plaquettes(
  model: GaugeModel,
  links: readonly number[],
): number[] {
  return model.domain.faces.map((f) => wilsonProduct(model, links, f.boundary));
}
/** Dimensionless Euclidean action; counting measure on all 2^E link words. */
export function gaugeAction(
  model: GaugeModel,
  links: readonly number[],
): number {
  return -model.K * plaquettes(model, links).reduce((a, b) => a + b, 0);
}
export function gaugeFlipDifference(
  model: GaugeModel,
  links: readonly number[],
  edgeId: string,
): number {
  if (!model.edgeIndex.has(edgeId)) throw new Error('Unknown physical link.');
  const p = plaquettes(model, links);
  return (
    2 *
    model.K *
    model.domain.faces.reduce(
      (sum, f, i) =>
        sum +
        (f.boundary.filter((e) => e.edgeId === edgeId).length % 2 ? p[i]! : 0),
      0,
    )
  );
}
/** U_vw -> g_v U_vw g_w, including both endpoints of a possible self-link. */
export function gaugeTransform(
  model: GaugeModel,
  links: readonly number[],
  negativeVertices: readonly string[],
): number[] {
  validateLinks(model, links);
  if (
    new Set(negativeVertices).size !== negativeVertices.length ||
    negativeVertices.some(
      (id) => !model.domain.vertices.some((v) => v.id === id),
    )
  )
    throw new Error('Select distinct existing vertices.');
  const g = new Set(negativeVertices);
  return model.domain.edges.map(
    (e, i) => links[i]! * (g.has(e.tail) ? -1 : 1) * (g.has(e.head) ? -1 : 1),
  );
}
export function gaugeObservables(
  model: GaugeModel,
  links: readonly number[],
): Record<string, number> {
  const p = plaquettes(model, links);
  return {
    meanPlaquette: p.reduce((a, b) => a + b, 0) / p.length,
    action: -model.K * p.reduce((a, b) => a + b, 0),
    ...Object.fromEntries(
      model.loops.map((loop) => [
        loop.id,
        wilsonProduct(model, links, loop.boundary),
      ]),
    ),
  };
}
