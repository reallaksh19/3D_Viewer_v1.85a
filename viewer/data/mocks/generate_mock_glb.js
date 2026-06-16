import fs from 'fs';

// This is a minimal valid 2.0 GLB containing just a buffer, suitable for fallback testing.
// It doesn't contain actual geometry to keep it simple, just enough to not crash a lazy loader.
// Let's instead write a tiny JS function we can just call from the browser to generate the GLB,
// bypassing Node entirely so we don't have to deal with polyfills.
