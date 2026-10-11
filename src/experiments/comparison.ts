import type { ArchiveEntry } from './archive';

export type ObservableDescriptor = {
  id: string;
  label: string;
  unit: string;
  value: number | null;
};
export function descriptors(entry: ArchiveEntry): ObservableDescriptor[] {
  const capture = entry.scientific.capture;
  if (capture.workspace === 'lattice') {
    const s = capture.segment;
    return [
      {
        id: 'lattice:m',
        label: 'Signed magnetization m',
        unit: 'spin/site',
        value: s.m.mean,
      },
      {
        id: 'lattice:absM',
        label: '|m|',
        unit: 'spin/site',
        value: s.absM.mean,
      },
      {
        id: 'lattice:e',
        label: 'Physical energy density e=H/N',
        unit: 'energy/site',
        value: s.e.mean,
      },
      {
        id: 'lattice:chi',
        label: 'Susceptibility χ',
        unit: 'spin²/temperature',
        value: s.fluctuations?.susceptibility ?? null,
      },
      {
        id: 'lattice:binder',
        label: 'Binder cumulant U₄',
        unit: 'dimensionless',
        value: s.fluctuations?.binder ?? null,
      },
      {
        id: 'lattice:cv',
        label: 'Specific heat cV',
        unit: 'energy/(site·temperature)',
        value: s.fluctuations?.specificHeat ?? null,
      },
      {
        id: 'lattice:gx',
        label: 'Gx(1)',
        unit: 'spin product',
        value: s.gx.mean,
      },
      {
        id: 'lattice:gy',
        label: 'Gy(1)',
        unit: 'spin product',
        value: s.gy.mean,
      },
    ];
  }
  const s = capture.segment;
  if (s.model.kind === 'ising')
    return [
      {
        id: 'graph:m',
        label: 'Graph magnetization m',
        unit: 'spin/site',
        value: s.ising?.observables.m?.moments.mean ?? null,
      },
      {
        id: 'graph:E',
        label: 'Dimensionless total action E=S',
        unit: 'dimensionless action',
        value: s.ising?.observables.E?.moments.mean ?? null,
      },
    ];
  if (s.model.kind === 'scalar') {
    const target = s.model.parameters.domain.vertices[0]!.id;
    return [
      {
        id: `scalar:${target}`,
        label: `Scalar ${target}`,
        unit: 'real scalar',
        value: s.scalar?.targets[target]?.moments.mean ?? null,
      },
      {
        id: 'scalar:S',
        label: 'Dimensionless action S',
        unit: 'dimensionless action',
        value: s.scalar?.targets.S?.moments.mean ?? null,
      },
    ];
  }
  return [
    {
      id: `${s.model.kind}:primary`,
      label:
        s.model.kind === 'gaussian'
          ? 'Gaussian x'
          : s.model.kind === 'spin'
            ? 'Spin s'
            : 'Binomial K',
      unit: s.model.kind === 'binomial' ? 'count' : 'dimensionless',
      value: s.moments.mean,
    },
  ];
}
export function commonDescriptors(
  entries: readonly ArchiveEntry[],
): ObservableDescriptor[] {
  if (!entries.length) return [];
  return descriptors(entries[0]!).filter((descriptor) =>
    entries.every((entry) =>
      descriptors(entry).some(
        (other) => other.id === descriptor.id && other.unit === descriptor.unit,
      ),
    ),
  );
}
