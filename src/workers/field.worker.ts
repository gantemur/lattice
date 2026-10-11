/// <reference lib="webworker" />
import { FieldEngine } from '../engine/fieldRun';
import type { FieldRequest, FieldResponse } from '../engine/fieldRun';

const scope = self as DedicatedWorkerGlobalScope;
const engine = new FieldEngine();
scope.onmessage = ({ data }: MessageEvent<FieldRequest>) => {
  const response: FieldResponse = engine.handle(data);
  scope.postMessage(response);
};
