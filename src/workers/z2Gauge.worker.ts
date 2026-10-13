/// <reference lib="webworker" />
import { GaugeEngine } from '../engine/z2GaugeRun';
import type { GaugeRequest } from '../engine/z2GaugeRun';
const scope = self as DedicatedWorkerGlobalScope;
const engine = new GaugeEngine();
scope.onmessage = ({ data }: MessageEvent<GaugeRequest>) =>
  scope.postMessage(engine.handle(data));
