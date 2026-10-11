import type { IsingModel } from '../models/ising';
import { isingTargets, observableValue } from '../models/ising';
import { emptyMoments, recordMoment, summarizeMoments } from './moments';
import { ConvergenceHistory } from './convergence';
import { DiagnosticHistory } from './statisticalDiagnostics';
export class IsingMeasurements {
  private counts: number[];
  private observables;
  private diagnostics = new DiagnosticHistory(1);
  constructor(private model: IsingModel) {
    this.counts = Array(2 ** model.parameters.domain.vertices.length).fill(0);
    this.observables = Object.fromEntries(
      isingTargets(model).map((target) => [
        target,
        { moments: emptyMoments(), convergence: new ConvergenceHistory() },
      ]),
    );
  }
  record(state: number) {
    this.counts[state]!++;
    const m = observableValue(this.model, state, 'm');
    this.diagnostics.record(
      m,
      Math.abs(m),
      observableValue(this.model, state, 'E'),
    );
    for (const [target, entry] of Object.entries(this.observables)) {
      recordMoment(entry.moments, observableValue(this.model, state, target));
      entry.convergence.record(entry.moments.count, entry.moments.mean);
    }
  }
  snapshot() {
    return {
      counts: [...this.counts],
      diagnostics: this.diagnostics.snapshot(),
      observables: Object.fromEntries(
        Object.entries(this.observables).map(([target, e]) => [
          target,
          {
            moments: summarizeMoments(e.moments),
            convergence: e.convergence.snapshot(),
          },
        ]),
      ),
    };
  }
}
export type IsingMeasurementSnapshot = ReturnType<
  IsingMeasurements['snapshot']
>;
