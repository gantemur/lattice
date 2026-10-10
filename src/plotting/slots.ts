import type { Settings } from '../algorithms/transitions';
import { variableName } from '../models/singleVariable';
export type PlotAssignment = {
  target: string;
  plot:
    | 'density'
    | 'trajectory'
    | 'mean'
    | 'error'
    | 'acceptance'
    | 'correlation'
    | 'conditional';
};
export type Slot = PlotAssignment | null;
export type Slots = PlotAssignment[];
export const MAX_PLOTS = 6;
export function defaultSlots(settings: Settings): Slots {
  const target = variableName(settings.model);
  return [
    { target, plot: 'density' },
    { target, plot: 'trajectory' },
  ];
}
export function assignSlot(
  slots: Slots,
  index: number,
  assignment: Slot,
): Slots {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length)
    throw new Error('Invalid plot.');
  return assignment
    ? slots.map((s, i) => (i === index ? assignment : s))
    : slots.filter((_, i) => i !== index);
}
export function addSlot(slots: Slots, assignment: PlotAssignment): Slots {
  if (slots.length >= MAX_PLOTS) throw new Error('At most six plots.');
  return [...slots, assignment];
}
export function swapSlots(slots: Slots, first: number, second: number): Slots {
  if (
    ![first, second].every(
      (i) => Number.isInteger(i) && i >= 0 && i < slots.length,
    )
  )
    throw new Error('Invalid plot.');
  const next = [...slots];
  [next[first], next[second]] = [slots[second]!, slots[first]!];
  return next;
}
