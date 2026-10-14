import type { ComponentProps } from 'react';
import { GaugeCellGraph } from './GaugeCellGraph';
import { plaquettes } from '../models/z2Gauge';
import type { GaugeModel } from '../models/z2Gauge';

/** Z₂-specific labels stay out of the geometry-only renderer. */
export function GaugeGraph({
  model,
  links,
  ...selection
}: Omit<
  ComponentProps<typeof GaugeCellGraph>,
  'model' | 'linkLabels' | 'linkColors' | 'faceLabels' | 'groupLabel' | 'note'
> & { model: GaugeModel; links: number[] }) {
  const p = plaquettes(model, links);
  return (
    <GaugeCellGraph
      {...selection}
      model={model}
      linkLabels={model.domain.edges.map(
        (e, i) => `${e.id}: ${links[i] === 1 ? '+1' : '−1'}`,
      )}
      linkColors={links.map((u) => (u === 1 ? '#166c67' : '#ba503c'))}
      faceLabels={model.domain.faces.map(
        (f, i) => `${f.id}: P = ${p[i] === 1 ? '+1' : '−1'}`,
      )}
      groupLabel={`${links.length} independent oriented Z₂ links`}
      note="Teal +1; rust −1."
    />
  );
}
