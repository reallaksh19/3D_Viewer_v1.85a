import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installInputXmlDxfBranchPicker } from './model-converters/inputxml-dxf-branch-picker.js';
import { installInputXmlDxfLegacyBridge } from './model-converters/inputxml-dxf-legacy-bridge.js';
import { installInputXmlDxfProjectionOption } from './model-converters/inputxml-dxf-projection-option.js';
import { installInputXmlDxfSymbolOption } from './model-converters/inputxml-dxf-symbol-option.js';
import { installInputXmlGlbLegacyBridge } from './model-converters/inputxml-glb-legacy-bridge.js';
import { installInputXmlPropertyTransferUi } from './model-converters/inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';

const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['inputxml-dxf-legacy-bridge', installInputXmlDxfLegacyBridge],
  ['inputxml-dxf-symbol-option', installInputXmlDxfSymbolOption],
  ['inputxml-dxf-projection-option', installInputXmlDxfProjectionOption],
  ['inputxml-glb-legacy-bridge', installInputXmlGlbLegacyBridge],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
]);

function installSafely(name, installer, container) {
  try {
    installer(container);
  } catch (error) {
    console.error(`[ModelConverters] Optional installer failed: ${name}`, error);
  }
}

function installBranchPickerImmediately(container) {
  try {
    // Keep this synchronous and explicit: the branch picker is a lightweight
    // legacy InputXML→DXF enhancer and its static gate checks this installer call.
    installInputXmlDxfBranchPicker(container);
  } catch (error) {
    console.error('[ModelConverters] Optional installer failed: inputxml-dxf-branch-picker', error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);

  // Install the branch picker immediately after legacy render so existing
  // InputXML→DXF controls are available for tests/users, while heavier XML/CII
  // workflow helpers remain deferred and guarded for tab responsiveness.
  installBranchPickerImmediately(container);

  // Emergency responsiveness guard:
  // keep the legacy converter UI as the only synchronous renderer. XML/CII popup
  // is now a lightweight launcher only; heavy XML/CII observer/nesting installers
  // are intentionally not auto-installed here.
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));

  return result;
}
