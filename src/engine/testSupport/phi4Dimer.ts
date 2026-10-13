// Test-only tensor-product midpoint quadrature: explicit dimer action, no
// production geometry/action/local-difference call. Refining spacing and then
// cutoff separately prevents a coincidentally stable truncated answer.
export function dimerIntegral(
  nodes: number,
  cutoff: number,
  periodic: boolean,
) {
  const step = (2 * cutoff) / nodes;
  let z = 0,
    mean = 0,
    second = 0,
    pair = 0,
    action = 0;
  for (let i = 0; i < nodes; i++)
    for (let k = 0; k < nodes; k++) {
      const x = -cutoff + (i + 0.5) * step,
        y = -cutoff + (k + 0.5) * step;
      const s =
        (x * x + y * y) / 2 +
        (x ** 4 + y ** 4) / 4 -
        0.2 * (x + y) +
        ((periodic ? 2 : 1) * 0.7 * (x - y) ** 2) / 2;
      const w = Math.exp(-s) * step * step;
      z += w;
      mean += w * x;
      second += w * x * x;
      pair += w * x * y;
      action += w * s;
    }
  return {
    logZ: Math.log(z),
    mean: mean / z,
    second: second / z,
    pair: pair / z,
    action: action / z,
  };
}
