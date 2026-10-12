/** Pause is allowed while a worker batch is in flight. The client finishes
 * that already-posted batch, then leaves the stream stopped. */
export function RunPauseControl({
  running,
  busy,
  ready,
  run,
  pause,
}: {
  running: boolean;
  busy: boolean;
  ready: boolean;
  run: () => void;
  pause: () => void;
}) {
  return (
    <button
      className="button primary"
      type="button"
      disabled={!running && (busy || !ready)}
      onClick={running ? pause : run}
    >
      {running ? 'Pause' : 'Run'}
    </button>
  );
}
