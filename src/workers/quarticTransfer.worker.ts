import { quarticTransferStudy } from '../models/quarticTransfer';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';

type Request = { id: number; parameters: QuarticOscillatorParameters };
type Reply =
  | { id: number; result: ReturnType<typeof quarticTransferStudy> }
  | { id: number; error: string };

// This worker has no RNG and no access to the Monte Carlo worker. The UI
// creates it only while transfer spectroscopy is actually displayed.
self.onmessage = (event: MessageEvent<Request>) => {
  const { id, parameters } = event.data;
  let reply: Reply;
  try {
    reply = { id, result: quarticTransferStudy(parameters) };
  } catch (cause) {
    reply = {
      id,
      error:
        cause instanceof Error ? cause.message : 'Transfer analysis failed.',
    };
  }
  self.postMessage(reply);
};
