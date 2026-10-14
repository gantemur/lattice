/// <reference lib="webworker" />
import { PottsEngine } from '../engine/pottsRun';
import type { PottsRequest } from '../engine/pottsRun';
const scope = self as DedicatedWorkerGlobalScope;
const engine = new PottsEngine();
scope.onmessage = ({ data }: MessageEvent<PottsRequest>) =>
  scope.postMessage(engine.handle(data));
