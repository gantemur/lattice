import type { PottsModel } from '../models/potts';
import type { PottsSnapshot } from '../engine/pottsRun';
import { fkIneligibility, fkProbabilities } from '../models/fk';
import { canEnumerateFK, exactFK } from '../models/fkExact';
import { exactPotts } from '../models/pottsExact';
import { PottsConfigurationView } from './PottsConfiguration';
import { formatNumber as fmt } from '../plotting/PlotFrame';
import { DisplayMath } from '../ui/Math';

export type FKOptions = { representation: string; word: number; other: number };
export const defaultFKOptions: FKOptions = {
  representation: 'clusters',
  word: 0,
  other: 0,
};
/** Tool controls own only display selections. All sampled auxiliary variables
 * and counters come from the acknowledged worker snapshot, never fresh RNG. */
export function FKTool({
  id,
  model,
  snapshot,
  site,
  bond,
  selectSite,
  selectBond,
  options,
  changeOptions,
}: {
  options: FKOptions;
  changeOptions: (options: FKOptions) => void;
  id: string;
  model: PottsModel;
  snapshot: PottsSnapshot | null;
  site: number;
  bond: string;
  selectSite: (i: number) => void;
  selectBond: (id: string) => void;
}) {
  const { representation, word, other } = options;
  const setRepresentation = (representation: string) =>
    changeOptions({ ...options, representation });
  const setWord = (word: number) => changeOptions({ ...options, word });
  const setOther = (other: number) => changeOptions({ ...options, other });
  const reason = fkIneligibility(model);
  if (reason)
    return (
      <p>
        {reason} Keep using Potts direct, Metropolis or heat bath; no physical
        parameters are changed automatically.
      </p>
    );
  const exact = canEnumerateFK(model) ? exactFK(model) : null,
    trace = snapshot?.cluster;
  const current = snapshot?.segments.at(-1),
    stats = current?.fk;
  const edgeIndex = model.bonds.findIndex((b) => b.id === bond),
    edge = model.bonds[edgeIndex],
    p = fkProbabilities(model);
  const sampleCount = current?.samples ?? 0;
  const unavailable = (
    <p>
      Sampled FK data are unavailable until a genuine FK joint draw or SW
      trajectory. Equal spin colors alone do not identify FK clusters.
    </p>
  );
  if (id === 'fk-configuration')
    return (
      <>
        <label>
          FK display
          <select
            value={representation}
            onChange={(e) => setRepresentation(e.target.value)}
          >
            <option value="clusters">FK component labels</option>
            <option value="colors">Potts spin colors</option>
          </select>
        </label>
        {!trace && unavailable}
        <PottsConfigurationView
          {...{ model, snapshot, site, bond, selectSite, selectBond }}
          clusters={representation === 'clusters' ? trace : undefined}
          flags={trace?.flags}
        />
        {trace && (
          <p data-testid="fk-current">
            {trace.count} components including isolates; {trace.occupied}/
            {model.bonds.length} occupied bonds; largest {trace.largest}/
            {model.size}. Site {site}: component c{trace.labels[site]}, size{' '}
            {trace.sizes[trace.labels[site]!]}; spin color{' '}
            {snapshot!.colors[site]}.
          </p>
        )}
        {edge && (
          <p data-testid="fk-bond">
            Bond {edge.id}: {edge.tail} → {edge.head}; K={fmt(edge.K)}, p=
            {fmt(p[edgeIndex]!)};{' '}
            {trace
              ? `occupied=${trace.flags[edgeIndex]}, current endpoint equality=${Number(trace.after[edge.tail] === trace.after[edge.head])}`
              : 'no sampled occupation yet'}
            .
          </p>
        )}
        <p className="plot-note">
          Solid bonds are occupied; faint dotted bonds are closed. Every
          physical bond remains selectable, including parallel and K=0 records.
          Distinct disconnected components may share a spin color. FK bonds are
          auxiliary variables, not gauge links. Only the latest actual auxiliary
          image is stored.
        </p>
      </>
    );
  if (id === 'fk-reference') {
    if (!exact)
      return (
        <p>
          Exact FK enumeration requires at most four sites and eight physical
          bonds. This larger system still supports SW and sampled cluster
          statistics.
        </p>
      );
    const code = Math.min(word, exact.states.length - 1),
      spin = exactPotts(model),
      target = Math.min(other, model.size - 1);
    return (
      <>
        <p data-testid="fk-exact">
          Exact enumeration: {exact.states.length} bond words; log Z_FK=
          {fmt(exact.logPartition)}, log Z_Potts={fmt(exact.logPottsPartition)}.
          Z_FK={fmt(Math.exp(exact.logPartition))}, Z_Potts=
          {fmt(Math.exp(exact.logPottsPartition))}. Sum K=
          {fmt(model.bonds.reduce((s, b) => s + b.K, 0))}.
        </p>
        <DisplayMath
          children={String.raw`Z_{\rm P}=e^{\sum_e K_e}Z_{\rm FK},\quad w(A)=q^{k(A)}\prod_{e\in A}p_e\prod_{e\notin A}(1-p_e)`}
        />
        <label>
          Exact FK bond word
          <input
            type="number"
            min="0"
            max={exact.states.length - 1}
            value={code}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n < exact.states.length)
                setWord(n);
            }}
          />
        </label>
        <p>
          Flags in physical bond order:{' '}
          {Array.from(exact.states[code]!).join(' ') || 'empty'}; k=
          {exact.components[code]!.count}, occupied=
          {exact.components[code]!.occupied}; log weight=
          {fmt(exact.logWeights[code]!)}, weight={fmt(exact.weights[code]!)},
          probability={fmt(exact.probabilities[code]!)}.
        </p>
        <div className="gauge-selectors">
          <label>
            FK pair first site
            <input
              type="number"
              min="0"
              max={model.size - 1}
              value={site}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n < model.size)
                  selectSite(n);
              }}
            />
          </label>
          <label>
            FK pair second site
            <input
              type="number"
              min="0"
              max={model.size - 1}
              value={target}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n < model.size)
                  setOther(n);
              }}
            />
          </label>
        </div>
        <p>
          Exact connectivity P({site}↔{target})=
          {fmt(exact.connectivity[site]![target]!)}; sampled{' '}
          {sampleCount && stats?.pairCounts
            ? fmt(stats.pairCounts[site]![target]! / sampleCount)
            : 'unavailable'}
          . Exact pair equality={fmt(spin.pairs[site]![target]!)}.
        </p>
        <DisplayMath
          children={String.raw`\langle\delta_{\sigma_i,\sigma_j}\rangle=\frac1q+\left(1-\frac1q\right)P(i\leftrightarrow j),\qquad \langle\eta_e\rangle=p_e\langle\delta_{\sigma_t,\sigma_h}\rangle`}
        />
        <p>
          Connected sites must share a color. Disconnected components receive
          independent uniform colors and agree with probability 1/q;
          conditioning on connectivity gives the identity above.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Physical bond</th>
                <th>p</th>
                <th>Exact occupied</th>
                <th>Sampled</th>
              </tr>
            </thead>
            <tbody>
              {model.bonds.map((b, e) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{fmt(p[e]!)}</td>
                  <td>{fmt(exact.bonds[e]!)}</td>
                  <td>
                    {sampleCount && stats
                      ? fmt(stats.bondCounts[e]! / sampleCount)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Distribution
          label="Cluster-count probability"
          exact={exact.clusterCounts}
          counts={stats?.clusterCounts}
          samples={sampleCount}
        />
        <Distribution
          label="Occupied-bond-count probability"
          exact={exact.bondCounts}
          counts={stats?.occupiedCounts}
          samples={sampleCount}
        />
        <p className="plot-note">
          Counting-measure normalization. Impossible open K=0 words have exactly
          zero probability. q=2: J_e=K_e/2 and connectivity equals the
          zero-field Ising raw pair correlation; all parallel-bond constants
          remain.
        </p>
      </>
    );
  }
  if (!stats) return unavailable;
  return (
    <>
      <p>
        Segment {current!.id}: {sampleCount} retained joint measurements. FK and
        spin aggregates use the same post-warm-up states and cadence. No error
        bars or mixing certification.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>FK observable</th>
              <th>Mean</th>
              <th>Exact reference</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['occupied', exact?.meanOccupied],
                [
                  'occupiedFraction',
                  exact
                    ? exact.meanOccupied / Math.max(1, model.bonds.length)
                    : undefined,
                ],
                ['clusters', exact?.meanClusters],
                [
                  'largestFraction',
                  exact ? exact.meanLargest / model.size : undefined,
                ],
              ] as const
            ).map(([key, reference]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{sampleCount ? fmt(stats.moments[key].mean) : '—'}</td>
                <td>
                  {reference === undefined ? 'unavailable' : fmt(reference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Distribution
        label="Largest-cluster-size probability"
        exact={exact?.largestSizes}
        counts={stats.largestSizes}
        samples={sampleCount}
      />
      <Distribution
        label="Mean number of clusters by size"
        exact={exact?.clusterSizes}
        counts={stats.clusterSizes}
        samples={sampleCount}
      />
      <p>
        Work including warm-up: {stats.work.trajectories} whole updates;{' '}
        {stats.work.bondVisits} physical-bond visits,{' '}
        {stats.work.colorAssignments} component-color assignments,{' '}
        {stats.work.uniforms} uniforms. Equal update counts across algorithms do
        not mean equal work.
      </p>
      <p>
        Recent retained cluster counts (latest 32 of at most 256 records):{' '}
        {current!.history
          .slice(-32)
          .map((v) => v.values['fk.clusters'])
          .join(', ') || 'none'}
        .
      </p>
      <p className="plot-note">
        Full-segment histograms and moments survive recent-history eviction.
        Cluster-size counts count components, not sites; their sum is the mean
        cluster count. Historical segments remain separate in the segment
        summary. No large all-pairs connectivity matrix is stored.
      </p>
    </>
  );
}
/** Compact bars retain all size bins but do not create 1024 DOM table rows. */
function Distribution({
  label,
  exact,
  counts,
  samples,
}: {
  label: string;
  exact?: number[];
  counts?: number[];
  samples: number;
}) {
  const length = exact?.length ?? counts?.length ?? 0,
    values = Array.from({ length }, (_, i) =>
      samples && counts ? counts[i]! / samples : 0,
    );
  const maximum = Math.max(1e-12, ...values, ...(exact ?? [])),
    width = 300 / Math.max(1, length);
  return (
    <figure>
      <figcaption>
        {label}; filled: sampled
        {exact ? ', line: exact' : '; exact unavailable'}
      </figcaption>
      <svg
        viewBox="0 0 320 120"
        role="img"
        aria-label={label}
        style={{ width: '100%', maxHeight: 150 }}
      >
        <text x="10" y="10" fontSize="10">
          Vertical range 0–{fmt(maximum)}
        </text>
        {values.map((v, i) => (
          <rect
            key={i}
            x={10 + i * width}
            y={100 - (85 * v) / maximum}
            width={Math.max(0.1, width * 0.8)}
            height={(85 * v) / maximum}
            fill="#166c67"
          />
        ))}
        {exact && (
          <polyline
            fill="none"
            stroke="#b95b3e"
            strokeWidth="2"
            points={exact
              .map(
                (v, i) =>
                  `${10 + (i + 0.4) * width},${100 - (85 * v) / maximum}`,
              )
              .join(' ')}
          />
        )}
        <text x="10" y="116" fontSize="10">
          0
        </text>
        <text x="285" y="116" fontSize="10">
          {length - 1}
        </text>
      </svg>
    </figure>
  );
}
export function FKTransition({ snapshot }: { snapshot: PottsSnapshot | null }) {
  const t = snapshot?.cluster;
  if (!t) return <p>No actual cluster trajectory in this segment yet.</p>;
  const preview = (a: ArrayLike<number>) =>
    Array.from(a).slice(0, 32).join(' ') +
    (a.length > 32 ? ' … (first 32)' : '');
  return (
    <div data-testid="fk-transition">
      <p>
        {t.sampler === 'sw'
          ? 'Swendsen–Wang whole trajectory'
          : 'Independent FK joint draw'}
        ; {t.changedSites} changed sites. No accept/reject test.
      </p>
      <p>
        Old colors: {preview(t.before)}. New colors: {preview(t.after)}.
      </p>
      <p>
        Actual bond flags: {preview(t.flags)}. Components: {preview(t.labels)}.
        Sizes: {preview(t.sizes)}. Component colors:{' '}
        {preview(t.componentColors)}.
      </p>
      <p>
        {t.occupied} occupied; {t.count} components; largest {t.largest}.{' '}
        {t.uniformCount} uniforms = {t.sampler === 'sw' ? t.flags.length : 1}{' '}
        {t.sampler === 'sw' ? 'bond trials' : 'exact-CDF draw'} + {t.count}{' '}
        component colors. {t.bondVisits} bond visits.
      </p>
      <p className="plot-note">
        Canonical component order follows the smallest site. Distinct components
        may receive the same color. Every SW bond consumes a uniform, even a
        disagreeing or zero-coupling bond. Latest actual transition only; tools
        do not sample.
      </p>
    </div>
  );
}
