export type PlotAssignment = {
  target: 'x';
  plot: 'density' | 'mean' | 'error';
};
export type Slot = PlotAssignment | null;
export type Slots = [Slot, Slot, Slot, Slot];
export const defaultSlots: Slots = [
  { target: 'x', plot: 'density' },
  { target: 'x', plot: 'mean' },
  null,
  null,
];
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
