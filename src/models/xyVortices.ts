import { TAU, validateXYState, wrapXY } from './xy';
import type { XYModel, XYState } from './xy';
export type XYFaceCharge = {
  id: string;
  winding: number;
  charge: number | null;
  status: 'valid' | 'ambiguous' | 'noninteger';
  increments: number[];
};
/** The π tie uses the stored forward representative −π; reverse traversal is
 * its exact negation. Within 10⁻¹⁰ rad of antipodal, report branch sensitivity.
 * A separate 10⁻¹⁰ winding tolerance bounds a few angle operations per face;
 * failure is diagnostic, never silently rounded into a certified vortex. */
export function xyVortices(model: XYModel, state: XYState) {
  validateXYState(model, state);
  const differences = model.bonds.map((b) =>
    wrapXY(state[b.head]! - state[b.tail]!),
  );
  const faces: XYFaceCharge[] = model.faces.map((face) => {
    const increments = face.boundary.map(
      ({ bond, sign }) => sign * differences[bond]!,
    );
    const winding = increments.reduce((a, b) => a + b, 0) / TAU;
    const ambiguous = face.boundary.some(
      ({ bond }) => Math.abs(Math.abs(differences[bond]!) - Math.PI) <= 1e-10,
    );
    const nearest = Math.round(winding);
    const status = ambiguous
      ? 'ambiguous'
      : Math.abs(winding - nearest) > 1e-10
        ? 'noninteger'
        : 'valid';
    return {
      id: face.id,
      winding,
      increments,
      status,
      charge: status === 'valid' ? (nearest === 0 ? 0 : nearest) : null,
    };
  });
  const valid = faces.filter((f) => f.charge !== null);
  const positive = valid.filter((f) => f.charge! > 0).length;
  const negative = valid.filter((f) => f.charge! < 0).length;
  const net = valid.reduce((s, f) => s + f.charge!, 0);
  const absolute = valid.reduce((s, f) => s + Math.abs(f.charge!), 0);
  return {
    faces,
    differences,
    positive,
    negative,
    net,
    absolute,
    validFaces: valid.length,
    ambiguous: faces.filter((f) => f.status === 'ambiguous').length,
    noninteger: faces.filter((f) => f.status === 'noninteger').length,
    // A partial image has no whole-configuration density/neutrality claim.
    density:
      faces.length > 0 && valid.length === faces.length
        ? absolute / faces.length
        : null,
  };
}
