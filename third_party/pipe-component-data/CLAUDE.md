# Agent Rules

Definition of done is a green cumulative phase gate.

Hard rules:

1. Do not edit `contracts/` or `fixtures/golden/` unless explicitly instructed.
2. Add or change public API only with an `api-surface.json` update.
3. Keep every source module under 200 lines.
4. Core code must not import Three.js, DOM APIs, browser globals, localStorage, or zustand.
5. Derived outputs are selectors/projections, not stored in AdapterGraph.
6. Every new feature needs a gate and at least one negative fixture.
