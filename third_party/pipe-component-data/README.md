# PipeComponentData

Shared piping component data and adapter APIs for UXML, CEG, PipeData, Solid3D, DXF, and analysis integrations.

## Delivery model

This repo uses phase gates. Each phase is cumulative: later gates must keep earlier gates green.

```bash
npm run gate:phase0
npm run gate:phase1
```

## Phase 0/1 scope

Implemented now:

- AdapterGraph contract scaffold.
- UXML-shaped `createAdapterGraph()`.
- Exact top-level key gate.
- JSON serializability gate.
- API surface lock gate.
- No module file above 200 lines.

Not implemented yet:

- CSV parser.
- UXML reader/writer.
- CEG bridge.
- PipeData DB enrichment.
- Solid3D renderer.
