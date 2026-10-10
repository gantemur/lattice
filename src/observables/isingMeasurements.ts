import type { IsingModel } from '../models/ising';
import { isingTargets, observableValue } from '../models/ising';
import { emptyMoments, recordMoment, summarizeMoments } from './moments';
import { ConvergenceHistory } from './convergence';
export class IsingMeasurements {
  private counts: number[];
  private observables;
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
    for (const [target, entry] of Object.entries(this.observables)) {
      recordMoment(entry.moments, observableValue(this.model, state, target));
      entry.convergence.record(entry.moments.count, entry.moments.mean);
    }
  }
  snapshot() {
    return {
      counts: [...this.counts],
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
