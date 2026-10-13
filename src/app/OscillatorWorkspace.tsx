import { defaultOscillatorConfiguration } from '../engine/fieldRun';
import { OscillatorView } from './OscillatorView';
import { useField } from './useField';
import { useState } from 'react';
import { QuarticOscillatorView } from './QuarticOscillatorView';

/** QM owns a separate client/worker from the mounted spatial-fields tab. */
export function OscillatorWorkspace() {
  const [model, setModel] = useState<'harmonic' | 'quartic'>('harmonic');
  return model === 'harmonic' ? (
    <HarmonicSession chooseQuartic={() => setModel('quartic')} />
  ) : (
    <QuarticOscillatorView chooseHarmonic={() => setModel('harmonic')} />
  );
}

function HarmonicSession({ chooseQuartic }: { chooseQuartic: () => void }) {
  const { view, client } = useField(defaultOscillatorConfiguration);
  return (
    <OscillatorView
      view={view}
      client={client.current}
      chooseQuartic={chooseQuartic}
    />
  );
}
