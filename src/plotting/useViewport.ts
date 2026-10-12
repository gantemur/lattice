import { useEffect, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import { expandViewport, fitSegments } from './viewport';
import type { PlotViewport } from './viewport';

export type ViewportMemory = Map<
  string,
  { runId: number; range: PlotViewport }
>;

export function useViewport(
  snapshot: Snapshot | null,
  memory?: ViewportMemory,
  memoryKey?: string,
) {
  const [saved, setSaved] = useState<{
    runId: number;
    range: ReturnType<typeof fitSegments>;
  } | null>(() => (memoryKey ? (memory?.get(memoryKey) ?? null) : null));
  const needed = snapshot ? fitSegments(snapshot.segments) : null;
  const range =
    needed && snapshot
      ? saved?.runId === snapshot.runId
        ? expandViewport(saved.range, needed)
        : needed
      : null;
  const key = JSON.stringify(range);
  useEffect(() => {
    if (range && snapshot) {
      const next = { runId: snapshot.runId, range };
      setSaved(next);
      if (memoryKey) memory?.set(memoryKey, next);
    }
    // Only changed numeric bounds trigger state; redraws never touch the worker.
  }, [key, snapshot?.runId]);
  return {
    range,
    fitAll: () => {
      if (needed && snapshot) {
        const next = { runId: snapshot.runId, range: needed };
        setSaved(next);
        if (memoryKey) memory?.set(memoryKey, next);
      }
    },
  };
}
