import { defaultOscillatorConfiguration } from '../engine/fieldRun';
import { OscillatorView } from './OscillatorView';
import { useField } from './useField';

/** QM owns a separate client/worker from the mounted spatial-fields tab. */
export function OscillatorWorkspace() {
  const { view, client } = useField(defaultOscillatorConfiguration);
  return <OscillatorView view={view} client={client.current} />;
}
