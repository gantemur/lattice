import { SimulationEngine } from '../engine/simulationEngine';
import type { WorkerRequest, WorkerResponse } from '../engine/protocol';

// A narrow worker surface avoids mixing DOM and WebWorker global library types.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(response: WorkerResponse): void;
};
const engine = new SimulationEngine();
scope.onmessage = ({ data }) => scope.postMessage(engine.handle(data));
