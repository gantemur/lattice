import { useEffect, useRef, useState } from 'react';
import { LatticeClient } from '../engine/latticeClient';
import type { LatticeView, LatticeWorkerPort } from '../engine/latticeClient';
import type { LatticeConfiguration } from '../engine/latticeRun';

/** One mounted workspace owns one worker and its authoritative seeded run. */
export function useLatticeSession(initial: LatticeConfiguration) {
  const [view, setView] = useState<LatticeView>({
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  });
  const client = useRef<LatticeClient | null>(null);
  useEffect(() => {
    const instance = new LatticeClient(
      () =>
        new Worker(new URL('../workers/lattice.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as LatticeWorkerPort,
      setView,
    );
    client.current = instance;
    instance.initialize(initial);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, [initial]);
  return { view, client };
}
