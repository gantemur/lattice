import { useEffect, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import { expandViewport, fitSegments } from './viewport';

export function useViewport(snapshot: Snapshot | null) {
  const [saved, setSaved] = useState<{
    runId: number;
    range: ReturnType<typeof fitSegments>;
  } | null>(null);
  const needed = snapshot ? fitSegments(snapshot.segments) : null;
  const range =
    needed && snapshot
      ? saved?.runId === snapshot.runId
        ? expandViewport(saved.range, needed)
        : needed
      : null;
  const key = JSON.stringify(range);
  useEffect(() => {
    if (range && snapshot) setSaved({ runId: snapshot.runId, range });
    // Only changed numeric bounds trigger state; redraws never touch the worker.
  }, [key, snapshot?.runId]);
  return {
    range,
    fitAll: () => {
      if (needed && snapshot)
        setSaved({ runId: snapshot.runId, range: needed });
    },
  };
}
