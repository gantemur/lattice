# M3b1 architecture and proposed portable schema

This design precedes implementation. M3b1 saves one existing parameter segment at a time; it does not run sweeps or alter transition kernels.

## Capture boundary

Each existing worker gains a read-only `capture(runId, requestId, segmentId)` command. It copies the selected segment snapshot and its available ordered M3a diagnostic rings. The reply carries the run ID, request ID and unchanged worker version. A client permits capture only while paused, idle and free of pending parameter changes; it rejects stale replies and verifies the version against its last acknowledged snapshot. Capturing all segments issues sequential requests. The archive never receives raw rings on routine Run snapshots.

For non-Ising Small Systems, the available bounded transition/trajectory record is copied with its existing update coordinates. Earlier samples beyond that record remain unavailable. A current configuration is stored only for the active segment, explicitly at the capture update; a historical segment has no implied final configuration. A parameter-changed segment is marked snapshot-only, since the original seed and final parameters cannot replay its inherited spins/RNG.

## Version-1 bundle

The authoritative UTF-8 JSON object is `{format:"lattice-lab-experiments",schemaVersion:1,exportedAt,records:[...]}`. Every record has `{scientific,annotation}`. `scientific` contains a stable `datasetId`, `groupId`, source workspace/run/segment/version, capture update and timestamp, build revision or `unknown`, RNG version, seed and replayability, complete segment-local settings/model/domain, full aggregate summaries and histograms, diagnostic summaries, bounded raw observations with first observation index and cadence, available recent trajectories, explicit coverage/eviction counts, and optional current configuration tagged with its capture update. Lattice spins become ordinary `-1|1` arrays. `annotation` contains only a mutable display name and notes. A local `libraryId` disambiguates imported records whose scientific IDs already exist; the original scientific ID is never overwritten.

The schema stores native JSON numbers at full JavaScript precision, not formatted display strings. It never contains code, HTML, URL-embedded histories, or guessed timestamps. The numerical payload is copied on ingress and never edited by annotation controls. The library admits at most 16 records and a bounded total serialized payload. Import rejects oversized, malformed, non-finite, internally inconsistent, unsupported-version or incompatible-model records atomically. CSV measurements and CSV summary are derived views; a metadata JSON sidecar documents measurement columns, units, coverage and source IDs. Only the portable JSON bundle is imported.

## UI and comparison

The mounted Small Systems and Lattice Systems workspaces gain paused-only Save current/Save available controls. A third mounted Experiments workspace lists saved records, edits annotations, inspects provenance/aggregates/diagnostics/raw coverage, compares a few records through typed observable descriptors, and offers separately labeled downloads and JSON import. Its memory-only lifetime and archive limits are visible. M1a `E=S` and M2 `e=H/N` have distinct descriptor IDs and cannot be overlaid merely because both are called energy.
