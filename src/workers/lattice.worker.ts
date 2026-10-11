import { LatticeEngine } from '../engine/latticeRun';
import type { LatticeRequest, LatticeResponse } from '../engine/latticeRun';
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LatticeRequest>) => void) | null;
  postMessage(response: LatticeResponse): void;
};
const engine = new LatticeEngine();
scope.onmessage = ({ data }) => scope.postMessage(engine.handle(data));
