/// <reference lib="webworker" />
import { XYEngine } from '../engine/xyRun';
import type { XYRequest } from '../engine/xyRun';
const scope = self as DedicatedWorkerGlobalScope;
const engine = new XYEngine();
scope.onmessage = ({ data }: MessageEvent<XYRequest>) =>
  scope.postMessage(engine.handle(data));
