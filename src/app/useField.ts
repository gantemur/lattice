import { useEffect, useRef, useState } from 'react';
import { FieldClient } from '../engine/fieldClient';
import type { FieldView, FieldWorkerPort } from '../engine/fieldClient';
import type { FieldConfiguration } from '../engine/fieldRun';

/** Each call owns one FieldClient and one worker for its entire mounted life.
 * App hides inactive workspaces without unmounting, so navigation preserves
 * both their numerical streams and their local presentation state. */
export function useField(initial: FieldConfiguration) {
  const [view, setView] = useState<FieldView>({
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  });
  const client = useRef<FieldClient | null>(null);
  useEffect(() => {
    const instance = new FieldClient(
      () =>
        new Worker(new URL('../workers/field.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as FieldWorkerPort,
      setView,
    );
    client.current = instance;
    instance.initialize(initial);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  return { view, client };
}
