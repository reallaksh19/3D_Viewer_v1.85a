// vite.config.js  (CommonJS — no local vite install required)
// Tells Vite to leave all importmap-backed specifiers alone.
// three, three/addons/*, and the other CDN packages are resolved at runtime
// by the browser's <script type="importmap"> in viewer/index.html.

const EXTERNAL_PREFIXES = ['three', 'gltf-exporter', 'mdb-reader', 'buffer', 'xlsx'];

function isExternal(id) {
  return EXTERNAL_PREFIXES.some((p) => id === p || id.startsWith(p + '/'));
}

/** @type {import('vite').UserConfig} */
module.exports = {
  server: {
    port: 3000,
  },
  optimizeDeps: {
    // Never pre-bundle these — they live on the CDN
    exclude: EXTERNAL_PREFIXES,
  },
  plugins: [
    {
      name: 'importmap-external',
      enforce: 'pre',
      // Intercept before Vite's own import-analysis runs
      resolveId(id) {
        if (isExternal(id)) {
          // Returning { id, external: true } marks the import as browser-external.
          // Vite will leave the import statement exactly as-is in the emitted JS,
          // which is what we want so the browser importmap can resolve it.
          return { id, external: true };
        }
      },
    },
  ],
};
