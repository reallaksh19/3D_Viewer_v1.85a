import { renderSupportMappingConfigTab } from './support-mapping-config-tab.js';

const STATIC_NPS_ROWS = Object.freeze([
  { INCH: '0.50', 'OD(mm)': '21', BORE: '15', '5': '1.651', '5S': '1.651', '10': '2.1082', '10S': '2.1082', '30': '2.413', STD: '2.7686', '40': '2.7686', '40S': '2.7686', XS: '3.7338', '80': '3.7338', '80S': '3.7338', '160': '4.7752', XXS: '7.4676', 'OD(in)': '0.84' },
  { INCH: '0.75', 'OD(mm)': '27', BORE: '20', '5': '1.651', '5S': '1.651', '10': '2.1082', '10S': '2.1082', '30': '2.413', STD: '2.8702', '40': '2.8702', '40S': '2.8702', XS: '3.9116', '80': '3.9116', '80S': '3.9116', '160': '5.5626', XXS: '7.8232', 'OD(in)': '1.05' },
  { INCH: '1.00', 'OD(mm)': '33', BORE: '25', '5': '1.651', '5S': '1.651', '10': '2.77', '10S': '2.77', '30': '2.8956', STD: '3.3782', '40': '3.3782', '40S': '3.3782', XS: '4.5466', '80': '4.5466', '80S': '4.5466', '160': '6.35', XXS: '9.0932', 'OD(in)': '1.315' },
  { INCH: '1.25', 'OD(mm)': '42', BORE: '32', '5': '1.651', '5S': '1.651', '10': '2.77', '10S': '2.77', '30': '2.9718', STD: '3.556', '40': '3.556', '40S': '3.556', XS: '4.8514', '80': '4.8514', '80S': '4.8514', '160': '6.35', XXS: '9.7028', 'OD(in)': '1.66' },
  { INCH: '1.50', 'OD(mm)': '48', BORE: '40', '5': '1.651', '5S': '1.651', '10': '2.77', '10S': '2.77', '30': '3.175', STD: '3.683', '40': '3.683', '40S': '3.683', XS: '5.08', '80': '5.08', '80S': '5.08', '160': '7.1374', XXS: '10.16', 'OD(in)': '1.9' },
  { INCH: '2.00', 'OD(mm)': '60', BORE: '50', '5': '1.651', '5S': '1.651', '10': '2.77', '10S': '2.77', '30': '3.175', STD: '3.9116', '40': '3.9116', '40S': '3.9116', XS: '5.5372', '80': '5.5372', '80S': '5.5372', '160': '8.7376', XXS: '11.0744', 'OD(in)': '1.9' },
  { INCH: '2.50', 'OD(mm)': '73', BORE: '65', '5': '2.1082', '5S': '2.1082', '10': '3.048', '10S': '3.048', '30': '4.7752', STD: '5.1562', '40': '5.1562', '40S': '5.1562', XS: '7.0104', '80': '7.0104', '80S': '7.0104', '160': '9.525', XXS: '14.0208', 'OD(in)': '2.875' },
  { INCH: '3.00', 'OD(mm)': '89', BORE: '80', '5': '2.1082', '5S': '2.1082', '10': '3.048', '10S': '3.048', '30': '4.7752', STD: '5.4864', '40': '5.4864', '40S': '5.4864', XS: '7.62', '80': '7.62', '80S': '7.62', '160': '11.1252', XXS: '15.24', 'OD(in)': '3.5' },
  { INCH: '3.50', 'OD(mm)': '102', BORE: '90', '5': '2.1082', '5S': '2.1082', '10': '3.048', '10S': '3.048', '30': '4.7752', STD: '5.7404', '40': '5.7404', '40S': '5.7404', XS: '8.0772', '80': '8.0772', '80S': '8.0772', 'OD(in)': '4' },
  { INCH: '4.00', 'OD(mm)': '114', BORE: '100', '5': '2.1082', '5S': '2.1082', '10': '3.048', '10S': '3.048', '30': '4.7752', STD: '6.0198', '40': '6.0198', '40S': '6.0198', XS: '8.5598', '80': '8.5598', '80S': '8.5598', '120': '11.1252', '160': '13.4874', XXS: '17.1196', 'OD(in)': '4.5' },
  { INCH: '5.00', 'OD(mm)': '141', BORE: '125', '5': '2.7686', '5S': '2.7686', '10': '3.4036', '10S': '3.4036', STD: '6.5532', '40': '6.5532', '40S': '6.5532', XS: '9.525', '80': '9.525', '80S': '9.525', '120': '12.7', '160': '15.875', XXS: '19.05', 'OD(in)': '5.563' },
  { INCH: '6.00', 'OD(mm)': '168', BORE: '150', '5': '2.7686', '5S': '2.7686', '10': '3.4036', '10S': '3.4036', STD: '7.112', '40': '7.112', '40S': '7.112', XS: '10.9728', '80': '10.9728', '80S': '10.9728', '120': '14.2748', '160': '18.2626', XXS: '21.9456', 'OD(in)': '6.625' },
  { INCH: '8.00', 'OD(mm)': '219', BORE: '200', '5': '2.7686', '5S': '2.7686', '10': '3.7592', '10S': '3.7592', '20': '6.35', '30': '7.0358', STD: '8.1788', '40': '8.1788', '40S': '8.1788', '60': '10.3124', XS: '12.7', '80': '12.7', '80S': '12.7', '100': '15.0876', '120': '18.2626', '140': '20.6248', '160': '23.0124', XXS: '22.225', 'OD(in)': '8.625' },
  { INCH: '10.00', 'OD(mm)': '273', BORE: '250', '5': '3.4036', '5S': '3.4036', '10': '4.191', '10S': '4.191', '20': '6.35', '30': '7.7978', STD: '9.271', '40': '9.271', '40S': '9.271', '60': '12.7', XS: '12.7', '80': '15.0876', '80S': '12.7', '100': '18.2626', '120': '21.4376', '140': '25.4', '160': '28.575', XXS: '25.4', 'OD(in)': '10.75' },
  { INCH: '12.00', 'OD(mm)': '324', BORE: '300', '5': '3.9624', '5S': '3.9624', '10': '4.572', '10S': '4.572', '20': '6.35', '30': '8.382', STD: '9.525', '40': '10.3124', '40S': '9.525', '60': '14.2748', XS: '12.7', '80': '17.4752', '80S': '12.7', '100': '21.4376', '120': '25.4', '140': '28.575', '160': '33.3248', XXS: '25.4', 'OD(in)': '12.75' },
  { INCH: '14.00', 'OD(mm)': '356', BORE: '350', '5': '3.9624', '5S': '3.9624', '10': '6.35', '10S': '4.7752', '20': '7.9248', '30': '9.525', STD: '9.525', '40': '11.1252', '60': '15.0876', XS: '12.7', '80': '19.05', '100': '23.8252', '120': '27.7876', '140': '31.75', '160': '35.7124', 'OD(in)': '14' },
  { INCH: '16.00', 'OD(mm)': '406', BORE: '400', '5': '4.191', '5S': '4.191', '10': '6.35', '10S': '4.7752', '20': '7.9248', '30': '9.525', STD: '9.525', '40': '12.7', '60': '16.6624', XS: '12.7', '80': '21.4376', '100': '26.1874', '120': '30.9626', '140': '36.5252', '160': '40.4876', 'OD(in)': '16' },
  { INCH: '18.00', 'OD(mm)': '457', BORE: '450', '5': '4.191', '5S': '4.191', '10': '6.35', '10S': '4.7752', '20': '7.9248', '30': '11.1252', STD: '9.525', '40': '14.2748', '60': '19.05', XS: '12.7', '80': '23.8252', '100': '29.3624', '120': '34.925', '140': '39.6748', '160': '45.2374', 'OD(in)': '18' },
  { INCH: '20.00', 'OD(mm)': '508', BORE: '500', '5': '4.7752', '5S': '4.7752', '10': '6.35', '10S': '5.5372', '20': '9.525', '30': '12.7', STD: '9.525', '40': '15.0876', '60': '20.6248', XS: '12.7', '80': '26.1874', '100': '32.5374', '120': '38.1', '140': '44.45', '160': '50.0126', 'OD(in)': '20' },
  { INCH: '22.00', 'OD(mm)': '559', BORE: '550', '5': '4.7752', '5S': '4.7752', '10': '6.35', '10S': '5.5372', '20': '9.525', '30': '12.7', STD: '9.525', '60': '22.225', XS: '12.7', '80': '28.575', '100': '34.925', '120': '41.275', '140': '47.625', '160': '53.975', 'OD(in)': '22' },
  { INCH: '24.00', 'OD(mm)': '610', BORE: '600', '5': '5.5372', '5S': '5.5372', '10': '6.35', '10S': '6.35', '20': '9.525', '30': '14.2748', STD: '9.525', '40': '17.4752', '60': '24.6126', XS: '12.7', '80': '30.9626', '100': '38.8874', '120': '46.0248', '140': '52.3748', '160': '59.5376', 'OD(in)': '24' },
  ...['26','28','30','32','34','36','38','40','42','44','46','48','52','56','60','64','66','68','72','76','80'].map((inch) => ({ INCH: `${Number(inch).toFixed(2)}`, 'OD(mm)': {26:660,28:711,30:762,32:813,34:864,36:914,38:965,40:1016,42:1067,44:1118,46:1168,48:1219,52:1321,56:1422,60:1524,64:1626,66:1676,68:1727,72:1829,76:1930,80:2032}[inch], BORE: {26:650,28:700,30:750,32:800,34:850,36:900,38:950,40:1000,42:1050,44:1100,46:1150,48:1200,52:1300,56:1400,60:1500,64:1600,66:1650,68:1700,72:1800,76:1900,80:2000}[inch], STD: ['26','28','30','32','34','36','38','40','42','44','46','48'].includes(inch) ? '9.525' : '', XS: ['26','28','30','32','34','36','38','40','42','44','46','48'].includes(inch) ? '12.7' : '', 'OD(in)': inch })),
]);

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function loadRows() {
  return STATIC_NPS_ROWS;
}

function detailHost(root) {
  return root.querySelector('.model-converters-workflow-detail-title')?.parentElement
    || root.querySelector('.model-converters-workflow-popup-body')
    || root.querySelector('.model-converters-workflow-detail')
    || root;
}

function renderNpsTable(rows) {
  const headers = ['INCH', 'BORE', 'OD(mm)', 'OD(in)', 'STD', '40', '80', 'XS', '160', 'XXS'];
  return `<div class="model-converters-workflow-detail-title">8 NPS / Bore Master</div>
    <div class="model-converters-workflow-detail-text">Static NPS/BORE table: 1&quot; maps to BORE 25 mm and OD 33 mm; it is not 25.4 mm.</div>
    <div class="model-converters-workflow-master-card"><div class="model-converters-workflow-section-title">Static master</div><strong>${rows.length} row(s)</strong></div>
    <div class="model-converters-workflow-table-wrap" style="max-height:68vh;overflow:auto;"><table class="model-converters-workflow-table">
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}

function findWorkflowTabHosts(panel) {
  return Array.from(new Set([
    ...document.querySelectorAll('.model-converters-workflow-popup-tabs, .model-converters-workflow-phase-list'),
    ...panel.querySelectorAll('.model-converters-workflow-popup-tabs, .model-converters-workflow-phase-list'),
  ])).filter(Boolean);
}

function findConfigButton(host) {
  return Array.from(host.querySelectorAll('button, [role="button"]')).find((button) => {
    const text = (button.textContent || '').trim();
    return button.matches('[data-xml-cii-phase="config"]') || /(^|\s)(7\s*)?Config(\s|$)/i.test(text);
  });
}

function makeButton(reference, text, marker) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset[marker] = 'true';
  button.className = reference?.className || 'model-converters-workflow-phase';
  button.textContent = text;
  return button;
}

function install(panel) {
  for (const host of findWorkflowTabHosts(panel)) {
    const configButton = findConfigButton(host) || host.lastElementChild;
    if (!configButton) continue;
    if (!host.querySelector('[data-xml-cii-nps-master-phase]')) {
      const npsButton = makeButton(configButton, '8 NPS / Bore Master', 'xmlCiiNpsMasterPhase');
      configButton.after(npsButton);
      npsButton.addEventListener('click', async () => {
        const root = npsButton.closest('.model-converters-workflow-popup-overlay') || panel;
        const detail = detailHost(root);
        detail.innerHTML = renderNpsTable(await loadRows());
      });
    }
    const nps = host.querySelector('[data-xml-cii-nps-master-phase]') || configButton;
    if (!host.querySelector('[data-xml-cii-support-mapping-phase]')) {
      const supportButton = makeButton(configButton, '9 CII Support Mapping', 'xmlCiiSupportMappingPhase');
      nps.after(supportButton);
      supportButton.addEventListener('click', () => {
        const root = supportButton.closest('.model-converters-workflow-popup-overlay') || panel;
        const host = detailHost(root);
        host.innerHTML = '';
        renderSupportMappingConfigTab(host);
      });
    }
  }
}

export function enhanceNpsBoreMasterTab(panel) {
  if (!panel) return () => {};
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => install(panel));
  };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(panel, { childList: true, subtree: true });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => { cancelAnimationFrame(raf); observer.disconnect(); };
}
