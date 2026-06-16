# PCF Extract Audit Plan

Scope: PCF extraction only. XML conversion is out of scope.

## Files in scope

- viewer/rvm-pcf-extract/RvmPcfEmitter.js
- viewer/rvm-pcf-extract/RvmExtractHardening.js
- viewer/rvm-pcf-extract/RvmFinal2dCsvBuilder.js
- viewer/tabs/rvm-json-pcf-extract-tab.js
- viewer/pcf-legacy/services/master-table-service.js
- viewer/rvm-pcf-master-tabs/*

## Phase 1 audit gates

1. Master UI parity: compare intended master layout and present master layout, then record missing controls, missing fuzzy matching controls, and missing converted bore visibility.
2. Fuzzy mapping and bore conversion: rows with line key, NPS, DN, OD, or master-table bore evidence must resolve convertedBore or emit diagnostics.
3. Scope integrity: report full scope rows, selected scope rows, included rows, excluded rows, and PCF pipeline groups.
4. Coordinate integrity: missing required geometry must be an error and must not silently become origin coordinates.
5. SKEY and CA audit: PIPE must not emit SKEY by default. Source CA21 must be reported separately from PCF keyword ATTRIBUTE21.
6. Multi-PCF download: one pipeline downloads one PCF; multiple pipelines download one ZIP.

## Phase 1 pass criteria

- Audit report can be generated without changing PCF output.
- Report includes row counts, pipeline counts, missing coordinate counts, pipe SKEY count, CA21 count, and expected download mode.
- No XML converter files are changed.

## Next phases

- Phase 2: wire audit report into diagnostics panel.
- Phase 3: fix line key to bore and fuzzy mapping.
- Phase 4: fix emitter behavior.
- Phase 5: replace multi-PCF popups with ZIP download.
- Phase 6: benchmark generated PCFs against supplied PCFs.
