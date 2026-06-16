import { notify } from '../diagnostics/notification-center.js';
import { getLinelist, getLinelistService } from '../core/linelist-store.js';

export function renderLinelist(container) {
  const store = getLinelist();
  const service = getLinelistService();

  const renderGrid = (data, headers) => {
    if (!data.length) return '<tr><td colspan="5" class="center muted">No preview data available</td></tr>';
    let html = `<thead><tr>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;
    data.slice(0, 10).forEach(row => {
        html += `<tr>`;
        headers.forEach(h => {
            html += `<td>${row[h] || ''}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody>`;
    return html;
  };

  container.innerHTML = `
    <div class="report-section" id="section-linelist">
      <h3 class="section-heading">Line list Manager</h3>
      <p class="tab-note">Import an Excel or CSV Linelist to enrich parsing data via Fuzzy Lookup.</p>

      <div class="upload-section" id="linelist-drop-zone" style="${store.data.length ? 'display:none;' : 'display:flex; flex-direction:column; align-items:center;'} margin-bottom: 1rem; border: 2px dashed var(--color-border); padding: 2rem; text-align: center; background: #fafbfc; border-radius: var(--radius); cursor: pointer;">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">Drop Linelist Excel (.xlsx) or CSV file here</div>
        <div style="color: var(--color-muted); font-size: 0.85rem;">or click to browse</div>
        <input type="file" id="linelist-file-input" accept=".csv,.xlsx,.xls" style="display:none;" />
      </div>

      <div id="linelist-dashboard" style="${store.data.length ? 'display:block;' : 'display:none;'}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span id="linelist-header-info">
                  <strong>${store.filename || 'Loaded'}</strong> - ${store.data.length} rows, ${store.headers.length} columns.
              </span>
              <button class="btn-secondary" id="btn-linelist-clear">Clear Data</button>
          </div>

          <div id="linelist-grid-wrap" class="table-scroll" style="max-height: 250px; margin-bottom: 20px;">
              <table class="data-table" id="linelist-preview-table" style="width:100%; white-space: nowrap;">
                  ${renderGrid(store.data, store.headers)}
              </table>
          </div>

          <div id="linelist-mapping-wrap" style="background: #f4f6f8; padding: 15px; border-radius: 4px; border: 1px solid #ccc;">
              <h4 class="sub-heading">Smart Column Mapping</h4>
              <p class="tab-note">Map your Linelist columns to standard PCF attributes.</p>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                  <label><strong>Primary Line Key (Sequence Col)</strong>
                      <select id="sel-linelist-sequence" class="ll-mapping-select" style="width: 100%; padding: 4px; margin-top: 4px;">
                          <option value="">(Select Column)</option>
                          ${store.headers.map(h => `<option value="${h}" ${store.keys.sequenceCol === h ? 'selected' : ''}>${h}</option>`).join('')}
                      </select>
                  </label>
                  <label><strong>Optional Area/Service Key</strong>
                      <select id="sel-linelist-service" class="ll-mapping-select" style="width: 100%; padding: 4px; margin-top: 4px;">
                          <option value="">(Select Column)</option>
                          ${store.headers.map(h => `<option value="${h}" ${store.keys.serviceCol === h ? 'selected' : ''}>${h}</option>`).join('')}
                      </select>
                  </label>
              </div>

              <table class="data-table params-table" id="linelist-mapping-table" style="width: 100%; margin-bottom: 15px;">
                  <thead><tr><th>PCF Target Attribute</th><th>Source Column (Linelist)</th></tr></thead>
                  <tbody>
                      <tr>
                          <td><strong>Line Reference (Line No)</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="LineRef" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.LineRef === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Design Pressure (P1)</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="P1" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.P1 === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Design Temperature (T1)</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="T1" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.T1 === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Fluid Density (General)</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="DensityDirect" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.DensityDirect === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Gas Density</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="DensityGas" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.DensityGas === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Liquid Density</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="DensityLiquid" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.DensityLiquid === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Mixed Density</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="DensityMixed" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.DensityMixed === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Flow Velocity (General)</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="Velocity" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.Velocity === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Gas Velocity</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="VelocityGas" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.VelocityGas === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Liquid Velocity</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="VelocityLiquid" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.VelocityLiquid === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Mixed Velocity</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="VelocityMixed" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.VelocityMixed === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Gas Flow Rate</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="FlowGas" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.FlowGas === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Liquid Flow Rate</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="FlowLiquid" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.FlowLiquid === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                      <tr>
                          <td><strong>Mixed Flow Rate</strong></td>
                          <td>
                              <select class="ll-smart-map" data-key="FlowMixed" style="width: 100%; padding: 4px;">
                                  <option value="">(Auto Detect)</option>
                                  ${store.headers.map(h => `<option value="${h}" ${store.smartMap.FlowMixed === h ? 'selected' : ''}>${h}</option>`).join('')}
                              </select>
                          </td>
                      </tr>
                  </tbody>
              </table>

              <button class="btn-primary" id="btn-save-linelist-map">Save Configuration</button>
              <span id="map-save-status" style="margin-left: 10px; color: green; display: none;">Saved!</span>
          </div>
      </div>
    </div>
  `;

  // File Handlers
  const dropZone = container.querySelector('#linelist-drop-zone');
  const fileInput = container.querySelector('#linelist-file-input');

  if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.style.background = '#e6f7ff';
      });
      dropZone.addEventListener('dragleave', () => {
          dropZone.style.background = '#fafbfc';
      });
      dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.style.background = '#fafbfc';
          if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      });

      fileInput.addEventListener('change', (e) => {
          if (e.target.files.length) handleFile(e.target.files[0]);
      });
  }

  // Simple CSV text parser for basic support without massive libraries
  const handleFile = (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target.result;
          const rows = text.split(/\r?\n/).map(line => line.split(','));
          try {
              service.processRawData(file.name, rows);
              renderLinelist(container); // Re-render Tab
          } catch (err) {
              notify("Error parsing CSV: " + err.message);
          }
      };
      reader.readAsText(file);
  };

  // Actions
  container.querySelector('#btn-linelist-clear')?.addEventListener('click', () => {
      service.reset();
      renderLinelist(container);
  });

  container.querySelector('#btn-save-linelist-map')?.addEventListener('click', () => {
      const keys = {
          sequenceCol: container.querySelector('#sel-linelist-sequence').value,
          serviceCol: container.querySelector('#sel-linelist-service').value
      };
      service.updateKeys(keys);

      const mapping = {};
      container.querySelectorAll('.ll-smart-map').forEach(sel => {
          mapping[sel.getAttribute('data-key')] = sel.value;
      });
      service.updateSmartMapping(mapping);

      const status = container.querySelector('#map-save-status');
      status.style.display = 'inline';
      setTimeout(() => status.style.display = 'none', 2000);
  });

}
