// Topology, physical variables, and UI slot assignments are distinct objects.
export const singleSite = {
  id: 'single-site',
  vertices: [{ id: 'v0' }],
  edges: [],
} as const;

export type RealSiteVariable = {
  readonly id: string;
  readonly carrier: 'vertex';
  readonly carrierId: string;
  readonly kind: 'real';
};
