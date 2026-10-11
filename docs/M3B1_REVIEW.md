# M3b1 review — saved experiments and portable data

M3b1 is implemented on `codex/m3b1-experiment-archive` from merged M3a (`0fbe7d8`, PR #8). It is not merged or deployed. The [architecture and version-1 schema](M3B1_ARCHITECTURE.md), [specification](SPECIFICATION.md), [roadmap](ROADMAP.md) and decision D-034 describe the contract. Automated sweeps are M3b2.

## Capture and numerical provenance

Small Systems and Lattice Systems stay mounted when the user enters Experiments. Run, Step, parameter segments, transition mathematics and Mulberry32 streams are unchanged. Saving requires Pause and an acknowledged idle worker boundary. Each worker handles a read-only request tagged by run/request/segment identity and returns the unchanged worker version. The client rejects a stale run, request or version, and multi-segment saves require one common version. A capture copies one segment's own settings/aggregates/histograms/diagnostics; no current global settings are substituted for a historical segment.

Graph and lattice Ising capture the actual ordered M3a rings for `m`, `|m|` and `e`/`E`, at most 8192 observations with one-based first index and explicit cadence. These rings still do **not** travel in routine Run snapshots. Lattice plots retain their separate latest 1000 complete measurement records, with discarded count. Other Small Systems models archive their actual latest 1000 transitions (including identifiable warm-up), not an invented complete sample series. A historical segment has no claimed final spin/vector configuration. A current configuration is copied only at the recorded capture update. Full-segment Welford/histogram counts remain distinct from shorter raw and recent diagnostic windows. M3a status and recent-window SE are never attached to the longer full-segment mean or nonlinear fluctuation estimates.

The original session seed is recorded for every segment. Only segment 1, which starts from its seeded initialization, is labeled `fresh-seeded`; subsequent inherited-state/stream segments are `snapshot-only`. The former designation records the required seed policy, sampler and settings, rather than promising bit-for-bit replay across different builds or JavaScript math implementations. A build SHA supplied through `VITE_GIT_SHA` is recorded when available; otherwise the field is `unknown`. RNG is labeled `mulberry32-v1`. Capture time is the save time; no earlier start timestamp is fabricated.

## Library, schema and files

Scientific data and annotations are separate in the version-1 JSON `lattice-lab-experiments` bundle. A browser-local library ID can differ from the immutable scientific dataset ID; importing the same file twice creates two local entries without overwriting either scientific identity. Numerical payloads are copied and deeply frozen in memory. The library permits at most 16 records and 12 MiB serialized data; imports over 16 MiB are rejected before parsing. Validation checks source/worker identity, supported models and geometry, sampler compatibility, finite numbers, aggregate/histogram counts, lattice sampling schedule, raw-ring lengths/indices, trajectory coordinates, and cross-consistency of overlapping lattice plot and diagnostic records. The entire bundle is validated before the library changes. Malformed imports leave existing records untouched. Files are text/JSON only, never executed or inserted as HTML.

Separate downloads produce the authoritative portable JSON bundle, `lattice-measurements.csv`, its `lattice-measurements.metadata.json` sidecar, and `lattice-summary.csv`. CSV fields preserve JavaScript numeric precision and escape commas, quotes and newlines. Measurement rows identify dataset/model/observable/unit, one-based segment observation number, global elementary update, meaningful nominal sweep coordinate, value and source record. The sidecar carries each dataset's configuration, seed, cadence, full count and raw coverage. The summary includes physical 2D lattice settings and explicitly separate energy/action columns. Arbitrary CSV import is not supported. M1b scalar configuration-only URLs remain unchanged; a separate lattice configuration URL was optional and is deferred.

The archive compares only shared typed observable descriptors. Graph `E=S` and lattice `e=H/N` have different IDs and units and cannot appear as one common value. Side-by-side values are full-segment point estimates, with separate diagnostic quality; no raw histories are pooled and no error bars are inferred for χ, Binder or cV. A saved histogram and bounded recent `m` series are available in the detail view where the source contains them. Results stay in browser memory only; refresh may discard them unless a JSON bundle was downloaded.

## Validation and limits

Unit tests cover all five Small Systems families and 2D Ising captures, seeded state invariance, active and historical segments, worker acknowledgment/stale replies, 1000-transition and 8192-diagnostic coverage, typed-spin conversion, JSON import/export and duplicate IDs, invalid geometry/sampler/counts/nonfinite data/oversize input, CSV indices/precision/escaping/metadata and incompatible comparison descriptors. Browser tests cover save/export/reload/import, historical lattice capture, preserved live workspaces, navigation and no horizontal overflow in desktop Chromium, 360px Chromium phone and emulated iPhone WebKit. The full `npm run check` pipeline passes formatting, strict TypeScript, **248 unit tests in 30 files**, production build and **117 browser tests** across these three projects.

For a local production Chromium 2×2 run, saving a 3072-observation lattice segment took about 63 ms from button click through UI confirmation and produced a 103,215-byte portable JSON file. This is a short environment-specific capture observation, not a hardware-independent benchmark. Routine Run has no added raw-ring transfer; capture cost is paid only on demand. Browser-memory use is bounded by the 16-record/12-MiB library caps, while the existing workers retain their prior bounded histories.

The archive has no IndexedDB, backend, cloud upload or tab-close continuation. It does not reconstruct evicted raw samples from aggregate moments. Diagnostic summaries can lag the latest count until a scheduled M3a refresh; captured raw rings carry the latest actual values. A fixed warm-up budget does not prove equilibration, and a noisy or critical chain may correctly retain an unresolved diagnostic status. Sweep execution and parameter-axis plots remain M3b2.

## Production visual review

The screenshots show a saved lattice segment plus a separate Gaussian record. Desktop and 360px phone have no horizontal overflow; archive controls, annotations, plots and provenance details remain touch/keyboard accessible. The sampled values are illustrative, not evidence of equilibrium.

- [Desktop Experiments workspace](screenshots/m3b1-desktop.png)
- [Desktop saved-record detail](screenshots/m3b1-desktop-detail.png)
- [360px phone Experiments workspace](screenshots/m3b1-phone.png)
- [360px phone saved-record detail](screenshots/m3b1-phone-detail.png)
