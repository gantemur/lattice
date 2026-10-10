import type { Transition } from '../algorithms/transitions';
export const MAX_TRANSITIONS = 1000;
export type TransitionRecord = Transition & {
  update: number;
  segmentUpdate: number;
  segmentId: number;
  warmup: boolean;
};

/** Exact bounded ring. Warm-up and rejected/self transitions are retained too. */
export class TransitionHistory {
  private records: TransitionRecord[] = [];
  private next = 0;
  record(record: TransitionRecord): void {
    if (this.records.length < MAX_TRANSITIONS) this.records.push({ ...record });
    else this.records[this.next] = { ...record };
    this.next = (this.next + 1) % MAX_TRANSITIONS;
  }
  snapshot(): TransitionRecord[] {
    const ordered =
      this.records.length < MAX_TRANSITIONS
        ? this.records
        : [
            ...this.records.slice(this.next),
            ...this.records.slice(0, this.next),
          ];
    return ordered.map((record) => ({ ...record }));
  }
}
