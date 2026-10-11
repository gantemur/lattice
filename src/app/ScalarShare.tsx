import { useState } from 'react';
import type { RunConfiguration } from '../engine/protocol';
import {
  decodeScalarConfiguration,
  encodeScalarConfiguration,
} from './shareConfiguration';
export function ScalarShare({
  configuration,
  load,
}: {
  configuration: RunConfiguration;
  load: (c: RunConfiguration) => void;
}) {
  const [link, setLink] = useState(''),
    [message, setMessage] = useState('');
  return (
    <details className="settings scalar-share">
      <summary>Share scalar configuration</summary>
      <p className="plot-note">
        Share model, graph, physical parameters, sampler and seed only.
        Histories and trajectories are not included. Schema v1.
      </p>
      <button
        className="button"
        onClick={async () => {
          try {
            const value = encodeScalarConfiguration(
              configuration,
              location.href,
            );
            setLink(value);
            await navigator.clipboard.writeText(value);
            setMessage('Configuration link copied.');
          } catch (e) {
            setMessage(
              e instanceof Error
                ? e.message
                : 'Could not copy; use the link below.',
            );
          }
        }}
      >
        Copy configuration link
      </button>
      <label>
        Configuration link
        <textarea
          aria-label="Configuration link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          rows={3}
        />
      </label>
      <button
        className="button"
        onClick={() => {
          try {
            load(decodeScalarConfiguration(link));
            setMessage('Configuration loaded as a new seeded session.');
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : 'Invalid configuration.',
            );
          }
        }}
      >
        Load configuration link
      </button>
      <p role="status" className="plot-note">
        {message}
      </p>
    </details>
  );
}
