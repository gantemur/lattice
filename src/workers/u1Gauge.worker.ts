/// <reference lib="webworker" />
import { U1GaugeEngine } from '../engine/u1GaugeRun';
import type { U1Request } from '../engine/u1GaugeRun';
const scope = self as DedicatedWorkerGlobalScope;
const engine = new U1GaugeEngine();
scope.onmessage = ({ data }: MessageEvent<U1Request>) =>
  scope.postMessage(engine.handle(data));
