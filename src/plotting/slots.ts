import type { Settings } from '../algorithms/transitions';
import { variableName } from '../models/singleVariable';
export type PlotAssignment = {
  target: 'x' | 's' | 'K';
  plot: 'density' | 'trajectory' | 'mean' | 'error' | 'acceptance';
};
export type Slot = PlotAssignment | null;
export type Slots = [Slot, Slot, Slot, Slot];
export function defaultSlots(settings: Settings): Slots {
  const target = variableName(settings.model);
  return [
    { target, plot: 'density' },
    { target, plot: 'trajectory' },
    { target, plot: 'mean' },
    settings.sampler.kind === 'metropolis'
      ? { target, plot: 'acceptance' }
      : null,
  ];
}
export function assignSlot(
  slots: Slots,
  index: number,
  assignment: Slot,
): Slots {
  if (!Number.isInteger(index) || index < 0 || index >= 4)
    throw new Error('Invalid slot.');
  const next: Slots = [...slots];
  next[index] = assignment;
  return next;
}
export function swapSlots(slots: Slots, first: number, second: number): Slots {
  if (![first, second].every((i) => Number.isInteger(i) && i >= 0 && i < 4))
    throw new Error('Invalid slot.');
  const next: Slots = [...slots];
  [next[first], next[second]] = [slots[second]!, slots[first]!];
  return next;
}
