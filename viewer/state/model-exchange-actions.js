import { buildSourcePreview } from '../view/SourcePreviewBuilder.js';
import { buildCanonicalPreview } from '../view/CanonicalPreviewBuilder.js';
import { buildRenderedPreview } from '../view/RenderedPreviewBuilder.js';
import { CaesarXmlImportAdapter } from '../source/xml/CaesarXmlImportAdapter.js';
import { NeutralXmlImportAdapter } from '../source/xml/NeutralXmlImportAdapter.js';
import { PcfImportAdapter } from '../source/pcf/PcfImportAdapter.js';
import { PcfxImportAdapter } from '../source/pcfx/PcfxImportAdapter.js';
import { GlbImportAdapter } from '../source/glb/GlbImportAdapter.js';

function pickAdapter({ name = '', text = '', payload = null }) {
  if (payload && GlbImportAdapter.detect(payload)) return GlbImportAdapter;
  if (/\.pcfx(\.json)?$/i.test(name) || PcfxImportAdapter.detect(text)) return PcfxImportAdapter;
  if (/\.pcf$/i.test(name) || PcfImportAdapter.detect(text)) return PcfImportAdapter;
  if (/\.xml$/i.test(name) && CaesarXmlImportAdapter.detect(text)) return CaesarXmlImportAdapter;
  if (/\.xml$/i.test(name) && NeutralXmlImportAdapter.detect(text)) return NeutralXmlImportAdapter;
  if (CaesarXmlImportAdapter.detect(text)) return CaesarXmlImportAdapter;
  if (PcfImportAdapter.detect(text)) return PcfImportAdapter;
  if (PcfxImportAdapter.detect(text)) return PcfxImportAdapter;
  return NeutralXmlImportAdapter;
}

export async function importIntoModelExchange(store, { id = '', name = '', text = '', payload = null } = {}) {
  const Adapter = pickAdapter({ name, text, payload });
  const adapter = new Adapter();
  const result = await adapter.import({ id, name, text, payload });
  store.patch({
    sourceRecord: result.sourceRecord,
    parsed: result.parsed,
    project: result.project,
    sourcePreview: buildSourcePreview(result.sourceRecord),
    canonicalPreview: buildCanonicalPreview(result.project),
    renderedPreview: buildRenderedPreview(result.project, store.viewState),
  });
}

export function updateViewState(store, patch) {
  store.setViewState(patch);
  if (store.project) {
    store.patch({
      renderedPreview: buildRenderedPreview(store.project, store.viewState),
    });
  }
}
