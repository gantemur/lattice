import { useEffect, useRef, useState } from 'react';
import { SmallSystemsApp } from './SmallSystemsApp';
import { LatticeSystems } from './LatticeSystems';
import { FieldWorkspace } from './FieldWorkspace';
import { OscillatorWorkspace } from './OscillatorWorkspace';
import { Experiments } from './Experiments';
import type { SavedSweep } from '../experiments/sweepArchive';
import type { Capture, ArchiveEntry } from '../experiments/archive';
import { addArchiveEntries, createArchiveEntry } from '../experiments/archive';

type Workspace = 'small' | 'lattice' | 'qm' | 'fields' | 'experiments';

export function workspaceForHash(hash: string): Workspace {
  if (hash.startsWith('#experiments')) return 'experiments';
  // The QM route must precede the broad lattice prefix.
  if (hash.startsWith('#lattice-qm')) return 'qm';
  if (hash.startsWith('#lattice-systems')) return 'lattice';
  if (hash.startsWith('#fields-paths')) return 'fields';
  return 'small';
}

export function App() {
  // Keep hidden workspaces mounted so tab navigation does not reset their
  // worker sessions, measurements, or local view state.
  const [archive, setArchive] = useState<ArchiveEntry[]>([]);
  const [sweeps, setSweeps] = useState<SavedSweep[]>([]);
  const archiveRef = useRef<ArchiveEntry[]>([]);
  const sessionId = useRef(crypto.randomUUID());
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    typeof location === 'undefined' ? 'small' : workspaceForHash(location.hash),
  );
  useEffect(() => {
    const changed = () => setWorkspace(workspaceForHash(location.hash));
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  function saveCaptures(captures: Capture[]) {
    const entries = captures.map((capture) => {
      const model =
        capture.workspace === 'lattice'
          ? '2D Ising'
          : capture.segment.model.kind;
      const count =
        capture.workspace === 'lattice'
          ? capture.segment.samples
          : capture.segment.moments.count;
      return createArchiveEntry(
        capture,
        `${sessionId.current}:${capture.workspace}:${capture.runId}`,
        `${model} · segment ${capture.segment.id} · ${count} measurements`,
      );
    });
    const next = addArchiveEntries(archiveRef.current, entries);
    archiveRef.current = next;
    setArchive(next);
  }
  function updateArchive(next: ArchiveEntry[]) {
    archiveRef.current = next;
    setArchive(next);
  }
  return (
    <>
      <div className="workspace-surface" hidden={workspace !== 'small'}>
        <SmallSystemsApp
          saveCaptures={saveCaptures}
          archiveCount={archive.length}
        />
      </div>
      <div className="workspace-surface" hidden={workspace !== 'lattice'}>
        <LatticeSystems
          saveCaptures={saveCaptures}
          archiveCount={archive.length}
        />
      </div>
      <div className="workspace-surface" hidden={workspace !== 'experiments'}>
        <Experiments
          entries={archive}
          update={updateArchive}
          sweeps={sweeps}
          updateSweeps={setSweeps}
        />
      </div>
      <div className="workspace-surface" hidden={workspace !== 'fields'}>
        <FieldWorkspace />
      </div>
      <div className="workspace-surface" hidden={workspace !== 'qm'}>
        <OscillatorWorkspace />
      </div>
    </>
  );
}
