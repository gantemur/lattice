import type { XYModel } from '../models/xy';
/** Test-only direct Haar cubature. No production action, Bessel, character,
 * conditional, vortex or measurement function is called. Fix θ0=0 only at
 * h=0: the missing normalized common rotation has integral one. */
export function integrateXY(model: XYModel, n: number) {
  const angles = Array<number>(model.size).fill(0),
    bonds = model.bonds.map(() => 0);
  let Z = 0,
    mx = 0,
    action = 0,
    mAbs = 0,
    points = 0;
  function integrate(site: number) {
    if (site < model.size) {
      for (let j = 0; j < n; j++) {
        angles[site] = (2 * Math.PI * (j + 0.5)) / n - Math.PI;
        integrate(site + 1);
      }
      return;
    }
    const cosine = model.bonds.map((b) =>
      Math.cos(angles[b.head]! - angles[b.tail]!),
    );
    const x = angles.reduce((s, a) => s + Math.cos(a), 0) / model.size;
    const y = angles.reduce((s, a) => s + Math.sin(a), 0) / model.size;
    const S =
      -model.h * model.size * x -
      model.bonds.reduce((s, b, i) => s + b.K * cosine[i]!, 0);
    const w = Math.exp(-S);
    Z += w;
    points++;
    mx += w * x;
    action += w * S;
    mAbs += w * Math.hypot(x, y);
    bonds.forEach((_, i) => {
      bonds[i]! += w * cosine[i]!;
    });
  }
  integrate(model.h === 0 ? 1 : 0);
  return {
    Z: Z / points,
    mx: model.h === 0 ? 0 : mx / Z,
    action: action / Z,
    mAbs: mAbs / Z,
    bonds: bonds.map((b) => b / Z),
  };
}
export function angularQuadrature(R: number, mu = 0, n = 8192) {
  let Z = 0,
    x = 0,
    y = 0,
    second = 0;
  const bins = Array<number>(24).fill(0);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (2 * Math.PI * (i + 0.5)) / n,
      w = Math.exp(R * Math.cos(a - mu));
    Z += w;
    x += w * Math.cos(a);
    y += w * Math.sin(a);
    second += w * Math.cos(a) ** 2;
    bins[Math.min(23, Math.floor((i * 24) / n))]! += w;
  }
  return {
    Z: Z / n,
    x: x / Z,
    y: y / Z,
    second: second / Z,
    bins: bins.map((b) => b / Z),
  };
}
