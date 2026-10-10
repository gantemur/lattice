import { useEffect, useRef, useState } from 'react';
import { standardGaussianPreset } from '../engine/preset';
import {
  emptySimulationView,
  SimulationClient,
} from '../engine/simulationClient';
import type { WorkerPort } from '../engine/simulationClient';

export function useSimulation() {
  const [view, setView] = useState(emptySimulationView);
  const client = useRef<SimulationClient | null>(null);
  useEffect(() => {
    const instance = new SimulationClient(
      () =>
        new Worker(
          new URL('../workers/simulation.worker.ts', import.meta.url),
          { type: 'module' },
        ) as unknown as WorkerPort,
      setView,
    );
    client.current = instance;
    instance.initialize(standardGaussianPreset.configuration);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  return { view, client };
}
