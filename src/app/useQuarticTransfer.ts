import { useEffect, useState } from 'react';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import type { TransferStudy } from '../models/quarticTransfer';

type State = {
  key: string;
  result: TransferStudy | null;
  error: string | null;
};
const cache = new Map<string, TransferStudy>();
const MAX_CACHE = 4;

/** The component that calls this hook is mounted only for an open transfer
 * card. Stale replies cannot update a later physical parameter selection. */
export function useQuarticTransfer(parameters: QuarticOscillatorParameters) {
  const key = JSON.stringify(parameters);
  const [state, setState] = useState<State>({
    key,
    result: cache.get(key) ?? null,
    error: null,
  });
  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setState({ key, result: cached, error: null });
      return;
    }
    setState({ key, result: null, error: null });
    const worker = new Worker(
      new URL('../workers/quarticTransfer.worker.ts', import.meta.url),
      { type: 'module' },
    );
    let active = true;
    worker.onmessage = (
      event: MessageEvent<{
        id: number;
        result?: TransferStudy;
        error?: string;
      }>,
    ) => {
      if (!active || event.data.id !== 1) return;
      if (event.data.result) {
        cache.delete(key);
        cache.set(key, event.data.result);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
      }
      setState({
        key,
        result: event.data.result ?? null,
        error: event.data.error ?? null,
      });
      worker.terminate();
    };
    worker.onerror = () => {
      if (active)
        setState({ key, result: null, error: 'Transfer worker failed.' });
      worker.terminate();
    };
    worker.postMessage({ id: 1, parameters });
    return () => {
      active = false;
      worker.terminate();
    };
  }, [key]);
  return state.key === key ? state : { key, result: null, error: null };
}
