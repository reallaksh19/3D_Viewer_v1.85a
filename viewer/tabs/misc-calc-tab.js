import { state } from '../core/state.js';
import { computeOperatingConditions, computeMaxValues } from '../utils/max-finder.js';
import { getLinelistService } from '../core/linelist-store.js';
import { getCaesarMatchAttribute } from '../core/settings.js';
import { renderMiscCalcConsole } from './misc-calc-console.js';
import { renderMiscCalcLayout } from './misc-calc-layout.js';

import { getCalculator, registerCalculator } from '../calc/core/calc-registry.js';
import { runCalculation } from '../calc/core/calc-engine.js';
import { setSession, appendToHistory } from '../calc/core/calc-session.js';

import { VesselSkirtCalc } from '../calc/formulas/vessel-skirt.js';
import { TrunnionCalc } from '../calc/formulas/trunnion.js';
import { MomentumCalc } from '../calc/formulas/momentum.js';
import { FlangeLeakageCalc } from '../calc/formulas/flange-leakage.js';
import { ForceSummaryCalc } from '../calc/formulas/force-summary.js';
import { ReliefValveCalc } from '../calc/formulas/relief-valve.js';
import { NemaSm23Calc } from '../calc/formulas/nema-sm23.js';

import { generateSkirtSvg } from '../calc/svg/skirt-svg.js';
import { generateTrunnionSvg } from '../calc/svg/trunnion-svg.js';
import { generateRvSvg } from '../calc/svg/rv-svg.js';
import { generateNemaSvg } from '../calc/svg/nema-svg.js';
import { generateMomentumSvg } from '../calc/svg/momentum-svg.js';
import { generateSlugSvg } from '../calc/svg/slug-loads-svg.js';
import { resolveSlugInputs } from '../calc/resolvers/slug-input-resolver.js';
import { SlugLoadsCalc } from '../calc/formulas/slug-loads.js';

// Register all calculators
registerCalculator('mc-skirt', VesselSkirtCalc);
registerCalculator('mc-trunnion', TrunnionCalc);
registerCalculator('mc-momentum', MomentumCalc);
registerCalculator('mc-flange', FlangeLeakageCalc);
registerCalculator('mc-force', ForceSummaryCalc);
registerCalculator('mc-rvforce', ReliefValveCalc);
registerCalculator('mc-nema', NemaSm23Calc);
registerCalculator('mc-slug', SlugLoadsCalc);

let currentSlugResolverPayload = null;

export function renderMiscCalc(container) {
  const parsed = state.parsed;
  const llService = getLinelistService();
  const opCond = computeOperatingConditions(parsed) || {};
  const maxVals = computeMaxValues(parsed) || {};
  const flanges = parsed?.flanges || [];
  const forces = parsed?.forces || [];

  // Get inputs
  const T = opCond.T1 || 80;
  const Ta = opCond.T3 || 25; // Often ambient is min design temp or default 25
  const maxForce = maxVals.maxAppliedForce || { fx:0, fy:0, fz:0, magnitude:0 };

  // Trunnion sample element for OD / Wall
  let pipeEl = null;
  if (parsed?.elements?.length) {
     pipeEl = parsed.elements.find(e => e.od > 0 && e.wall > 0) || parsed.elements[0];
  }
  const od = pipeEl?.od || 0;
  const wall = pipeEl?.wall || 0;

  // Group unique OD/Wall sizes for Momentum Calculation
  const pipeGroups = {};
  if (parsed?.elements) {
    for (const el of parsed.elements) {
      if (el.od && el.wall) {
         const key = `${el.od.toFixed(2)}_${el.wall.toFixed(2)}`;
         if (!pipeGroups[key]) {
             let density = el.fluidDensity ? Math.round(el.fluidDensity * 1000000) : 1000;
             let velocity = 2.0;

             const matchAttr = getCaesarMatchAttribute();
             if (el[matchAttr]) {
                 const c2Raw = String(el[matchAttr]).trim();
                 const matchResult = llService.getSmartAttributes(c2Raw);

                 if (matchResult && matchResult.Found) {
                     // We grab the dedicated variables out of the new smart map logic for Misc Calc
                     // Since Misc Calc might need all of them, let's store them in the group.
                     // For default "density" we fallback to Direct > Liquid > Mixed > Gas.
                     const foundDensity = matchResult.DensityDirect || matchResult.DensityLiquid || matchResult.DensityMixed || matchResult.DensityGas;
                     const foundVelocity = matchResult.Velocity || matchResult.VelocityLiquid || matchResult.VelocityMixed || matchResult.VelocityGas;

                     if (foundDensity) density = parseFloat(foundDensity) || density;
                     if (foundVelocity) velocity = parseFloat(foundVelocity) || velocity;

                     // We attach the full spectrum to the pipeGroup so specific calculators can use them later
                     pipeGroups[key] = {
                         od: el.od, wall: el.wall, density, velocity, lineNo: el.lineNo,
                         details: { ...matchResult }
                     };
                     continue;
                 }
             }

             pipeGroups[key] = { od: el.od, wall: el.wall, density, velocity, lineNo: el.lineNo, details: {} };
         }
      }
    }
  }

  renderMiscCalcLayout(container);

  const panelsContainer = container.querySelector('#calc-panels');
  panelsContainer.innerHTML = `
      <!-- Vessel Skirt Temp -->
      <div class="panel-content active" id="mc-skirt" style="display:block;">
        <table class="data-table params-table" style="width:100%; max-width:400px; margin-bottom:20px;">
          <tbody>
            <tr><td class="param-key">Ambient Temp (Ta)</td><td><input type="number" id="mc-skirt-ta" value="${Ta}" style="width:80px;"> &deg;C</td></tr>
            <tr><td class="param-key">Top Skirt Temp (T)</td><td><input type="number" id="mc-skirt-t" value="${T}" style="width:80px;"> &deg;C</td></tr>
            <tr><td class="param-key">Insulation Const (K)</td><td><input type="number" id="mc-skirt-k" value="1.0" step="0.1" style="width:80px;"></td></tr>
            <tr><td class="param-key">Skirt Height (h)</td><td><input type="number" id="mc-skirt-h" value="3250" style="width:80px;"> mm</td></tr>
            <tr><td class="param-key">Wall Thickness (t)</td><td><input type="number" id="mc-skirt-t-wall" value="18" style="width:80px;"> mm</td></tr>
          </tbody>
        </table>
        <button class="btn-primary" id="btn-calc-skirt">Calculate Profile</button>
        <div id="skirt-results" style="margin-top: 15px; font-family: monospace; background: #f4f6f8; padding: 10px; border-radius: 4px;">Ready.</div>
      </div>

      <!-- Trunnion Calc -->
      <div class="panel-content" id="mc-trunnion" style="display:none;">
        <p class="tab-note">Inputs pre-filled from Max Applied Force node ${maxForce.node || 'N/A'}</p>
        <table class="data-table params-table" style="width:100%; max-width:400px; margin-bottom:20px;">
          <tbody>
            <tr><td class="param-key">Pipe OD</td><td><input type="number" id="mc-trun-od" value="${od}" style="width:80px;"> mm</td></tr>
            <tr><td class="param-key">Pipe Wall</td><td><input type="number" id="mc-trun-wall" value="${wall}" style="width:80px;"> mm</td></tr>
            <tr><td class="param-key">Fx (Axial)</td><td><input type="number" id="mc-trun-fx" value="${Math.round(maxForce.fx || 0)}" style="width:80px;"> N</td></tr>
            <tr><td class="param-key">Fy (Shear)</td><td><input type="number" id="mc-trun-fy" value="${Math.round(maxForce.fy || 0)}" style="width:80px;"> N</td></tr>
            <tr><td class="param-key">Fz (Shear)</td><td><input type="number" id="mc-trun-fz" value="${Math.round(maxForce.fz || 0)}" style="width:80px;"> N</td></tr>
            <tr><td class="param-key">Moment Arm (L)</td><td><input type="number" id="mc-trun-l" value="300" style="width:80px;"> mm</td></tr>
          </tbody>
        </table>
        <button class="btn-primary" id="btn-calc-trunnion">Calculate Stress</button>
        <div id="trunnion-results" style="margin-top: 15px; font-family: monospace; background: #f4f6f8; padding: 10px; border-radius: 4px;">Ready.</div>
      </div>

      <!-- Momentum Calc -->
      <div class="panel-content" id="mc-momentum" style="display:none;">
        <p class="tab-note">Calculates flow momentum force: F = &rho; &times; A &times; v&sup2;</p>
        <div style="overflow-x:auto;">
          <table class="data-table" id="table-momentum" style="width:100%; margin-bottom:10px; min-width: 500px;">
            <thead>
              <tr>
                <th>OD (mm)</th><th>Wall (mm)</th><th>ID (mm)</th><th>Area (m&sup2;)</th><th>Density (kg/m&sup3;)</th><th>Velocity (m/s)</th><th>Force (N)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(pipeGroups).map((g, idx) => {
                const id = g.od - (2 * g.wall);
                const area = (Math.PI / 4) * Math.pow(id / 1000, 2);
                return `
                  <tr data-idx="${idx}" data-area="${area}">
                    <td>${g.od.toFixed(2)}</td><td>${g.wall.toFixed(2)}</td><td>${id.toFixed(2)}</td><td>${area.toFixed(4)}</td>
                    <td><input type="number" class="calc-mom-dens" value="${g.density || 1000}" style="width:70px;" title="Gas: ${g.details.DensityGas||'N/A'} | Liq: ${g.details.DensityLiquid||'N/A'} | Mix: ${g.details.DensityMixed||'N/A'}"></td>
                    <td><input type="number" class="calc-mom-vel" value="${g.velocity || 2.0}" style="width:70px;" title="Gas: ${g.details.VelocityGas||'N/A'} | Liq: ${g.details.VelocityLiquid||'N/A'} | Mix: ${g.details.VelocityMixed||'N/A'}"></td>
                    <td class="calc-mom-force" style="font-weight:bold;">0.00</td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="7" class="center muted">No valid pipes found</td></tr>'}
            </tbody>
          </table>
        </div>
        <button class="btn-primary" id="btn-calc-momentum">Calculate Forces</button>
      </div>

      <!-- Flange Leakage -->
      <div class="panel-content" id="mc-flange" style="display:none;">
        <p class="tab-note">Extracted ${flanges.length} flanges from parsed CAESAR II data.</p>
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Node</th><th>Method</th><th>Pressure</th><th>Leakage Ratio</th><th>Status</th></tr></thead>
          <tbody>
            ${flanges.length ? flanges.map(f => `<tr><td>${f.node}</td><td>${f.method || 'NC-3658.3'}</td><td>${f.pressure || '-'}</td><td>${f.ratio ? f.ratio.toFixed(2) : '-'}</td><td>${f.ratio > 1 ? '<span style="color:red;">FAIL</span>' : '<span style="color:green;">PASS</span>'}</td></tr>`).join('') : '<tr><td colspan="5" class="center muted">No flanges found</td></tr>'}
          </tbody>
        </table>
        <button class="btn-primary" id="btn-calc-flange" style="margin-top: 10px;">Process Flanges</button>
      </div>

      <!-- Force Calculation -->
      <div class="panel-content" id="mc-force" style="display:none;">
        <p class="tab-note">Displaying all parsed external force nodes from ${state.fileName || 'input'}.</p>
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Node</th><th>Fx (N)</th><th>Fy (N)</th><th>Fz (N)</th><th>Magnitude (N)</th></tr></thead>
          <tbody>
            ${forces.length ? forces.map(f => `<tr><td>${f.node}</td><td>${f.fx}</td><td>${f.fy}</td><td>${f.fz}</td><td>${Math.sqrt(f.fx**2 + f.fy**2 + f.fz**2).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="5" class="center muted">No forces extracted</td></tr>'}
          </tbody>
        </table>
        <button class="btn-primary" id="btn-calc-force" style="margin-top: 10px;">Process Forces</button>
      </div>

      <!-- Relief Valve Forces -->
      <div class="panel-content" id="mc-rvforce" style="display:none;">
        <p class="tab-note">Calculates open and closed system reaction forces for Gas/Vapour discharge. (Imperial Units)</p>
        <table class="data-table params-table" style="width:100%; max-width:400px; margin-bottom:20px;">
          <tbody>
            <tr><td class="param-key">Set Pressure (P_set)</td><td><input type="number" id="mc-rv-pset" value="262" style="width:80px;"> psig</td></tr>
            <tr><td class="param-key">Relief Temp (T)</td><td><input type="number" id="mc-rv-t" value="335" style="width:80px;"> &deg;F</td></tr>
            <tr><td class="param-key">Ratio of Specific Heats (k)</td><td><input type="number" id="mc-rv-k" value="1.29" step="0.01" style="width:80px;"></td></tr>
            <tr><td class="param-key">Molecular Weight (M)</td><td><input type="number" id="mc-rv-mw" value="6.52" style="width:80px;"></td></tr>
            <tr><td class="param-key">Max Discharge Rate (W)</td><td><input type="number" id="mc-rv-w" value="101663" style="width:80px;"> lb/hr</td></tr>
            <tr><td class="param-key">Discharge Exit Area (A_E)</td><td><input type="number" id="mc-rv-ae" value="78.54" style="width:80px;"> in&sup2;</td></tr>
            <tr><td class="param-key">Atmospheric Pressure (P_A)</td><td><input type="number" id="mc-rv-pa" value="14.7" style="width:80px;"> psia</td></tr>
          </tbody>
        </table>
        <button class="btn-primary" id="btn-calc-rv">Calculate Forces</button>
        <div id="rv-results" style="margin-top: 15px; font-family: monospace; background: #f4f6f8; padding: 10px; border-radius: 4px;">Ready.</div>
      </div>

      <!-- NEMA SM23 Check -->
      <div class="panel-content" id="mc-nema" style="display:none;">
        <p class="tab-note">Evaluates piping loads against NEMA SM23 allowable limits. Select an anchor node to evaluate.</p>
        <div style="margin-bottom:10px;">
          <label><strong>Select Node:</strong>
            <select id="mc-nema-node" style="padding: 4px;">
              <option value="">-- Select Anchor Node --</option>
              ${Array.from(new Set(forces.map(f => f.node))).map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
          </label>
        </div>
        <table class="data-table params-table" style="width:100%; max-width:400px; margin-bottom:20px;">
          <tbody>
            <tr><td class="param-key">Equivalent Diameter (De)</td><td><input type="number" id="mc-nema-de" value="13.333" step="0.001" style="width:80px;"> inch</td></tr>
            <tr><td class="param-key" colspan="2" style="font-size:0.85em; color:#666;">(For a 24" pipe, De is approx 13.333")</td></tr>
            <tr><td class="param-key">Mx (Moment)</td><td><input type="number" id="mc-nema-mx" value="0" style="width:80px;"> N-m</td></tr>
            <tr><td class="param-key">My (Moment)</td><td><input type="number" id="mc-nema-my" value="0" style="width:80px;"> N-m</td></tr>
            <tr><td class="param-key">Mz (Moment)</td><td><input type="number" id="mc-nema-mz" value="0" style="width:80px;"> N-m</td></tr>
          </tbody>
        </table>
        <button class="btn-primary" id="btn-calc-nema">Evaluate Loads</button>
        <div id="nema-results" style="margin-top: 15px; font-family: monospace; background: #f4f6f8; padding: 10px; border-radius: 4px;">Ready.</div>
      </div>

      <!-- Slug Loads Check -->
      <div class="panel-content" id="mc-slug" style="display:none;">
        <p class="tab-note">Calculates flow momentum and dynamic amplification loads for slug flow events.</p>

        <div style="background: #fdfdfd; border: 1px solid #ddd; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
            <h4 style="margin-top: 0;">1. Data Basis</h4>
            <div style="display: flex; gap: 20px;">
                <label><strong>Select Element:</strong><br>
                    <select id="mc-slug-element" style="padding: 4px; width: 150px;">
                        <option value="">-- Manual/None --</option>
                        ${(parsed?.elements || []).map(e => `<option value="${e.id || e.SEQ_NO}">${e.id || e.SEQ_NO} (Node ${e.from} to ${e.to})</option>`).join('')}
                    </select>
                </label>
                <label><strong>Select Bend:</strong><br>
                    <select id="mc-slug-bend" style="padding: 4px; width: 150px;">
                        <option value="">-- Manual/None --</option>
                        ${(parsed?.bends || []).map(b => `<option value="${b.node}">Node ${b.node}</option>`).join('')}
                    </select>
                </label>
            </div>
        </div>

        <div style="background: #fdfdfd; border: 1px solid #ddd; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
            <h4 style="margin-top: 0;">2. Manual Input Fallbacks</h4>
            <p style="font-size: 0.85em; color: #666; margin-bottom: 10px;">Used if element/linelist mapping is missing.</p>
            <table class="data-table params-table" style="width:100%;">
              <tbody>
                <tr>
                  <td>Pipe OD (mm) <input type="number" id="mc-slug-od" value="${od}" style="width:60px;"></td>
                  <td>Wall (mm) <input type="number" id="mc-slug-wall" value="${wall}" style="width:60px;"></td>
                  <td>Density (kg/m³) <input type="number" id="mc-slug-dens" value="1000" style="width:60px;"></td>
                </tr>
                <tr>
                  <td>Length (mm) <input type="number" id="mc-slug-len" value="1000" style="width:60px;"></td>
                  <td>Velocity (m/s) <input type="number" id="mc-slug-vel" value="2.0" style="width:60px;"></td>
                  <td>Slug L (m) <input type="number" id="mc-slug-sluglen" value="5.0" style="width:60px;"></td>
                </tr>
                <tr>
                  <td>DAF <input type="number" id="mc-slug-daf" value="2.0" step="0.1" style="width:60px;"></td>
                  <td colspan="2">Line Tag <input type="text" id="mc-slug-line" value="" style="width:120px;" placeholder="Optional"></td>
                </tr>
              </tbody>
            </table>
        </div>

        <button class="btn-primary" id="btn-slug-resolve" style="margin-bottom: 10px;">Resolve Inputs</button>
        <button class="btn-secondary" id="btn-calc-slug" style="margin-bottom: 10px;" disabled>Calculate Loads</button>

        <div id="slug-resolution-table" style="display:none; margin-bottom: 15px;"></div>
        <div id="slug-results" style="font-family: monospace; background: #f4f6f8; padding: 10px; border-radius: 4px;">Ready.</div>
      </div>
  `;

  renderMiscCalcConsole(container.querySelector('#misc-calc-console-container'));

  const getUnitMode = () => container.querySelector('#mc-unit-mode').value;
  const titleEl = container.querySelector('#calc-title');
  const svgContainer = container.querySelector('#svg-container');

  const updateSvg = (target) => {
    let svgHtml = '<span style="color: #888;">[No sketch available]</span>';
    try {
      if (target === 'mc-skirt') {
        const t_wall_el = container.querySelector('#mc-skirt-t-wall');
        svgHtml = generateSkirtSvg({
          ta: parseFloat(container.querySelector('#mc-skirt-ta').value),
          t: parseFloat(container.querySelector('#mc-skirt-t').value),
          h: parseFloat(container.querySelector('#mc-skirt-h').value),
          t_wall: t_wall_el ? parseFloat(t_wall_el.value) : 18,
        });
      } else if (target === 'mc-trunnion') {
        svgHtml = generateTrunnionSvg({
          od: parseFloat(container.querySelector('#mc-trun-od').value),
          wall: parseFloat(container.querySelector('#mc-trun-wall').value),
          fx: parseFloat(container.querySelector('#mc-trun-fx').value),
          fy: parseFloat(container.querySelector('#mc-trun-fy').value),
          fz: parseFloat(container.querySelector('#mc-trun-fz').value),
          l: parseFloat(container.querySelector('#mc-trun-l')?.value || 300),
        });
      } else if (target === 'mc-momentum') {
        const velEl = container.querySelector('.calc-mom-vel');
        const densEl = container.querySelector('.calc-mom-dens');
        svgHtml = generateMomentumSvg({
          v: velEl ? parseFloat(velEl.value) : 0,
          density: densEl ? parseFloat(densEl.value) : 0
        });
      } else if (target === 'mc-rvforce') {
        svgHtml = generateRvSvg({
          pset: parseFloat(container.querySelector('#mc-rv-pset').value),
          w: parseFloat(container.querySelector('#mc-rv-w').value),
          ae: parseFloat(container.querySelector('#mc-rv-ae').value),
        });
      } else if (target === 'mc-nema') {
        const selectedNode = container.querySelector('#mc-nema-node').value;
        const nodeForces = forces.filter(f => f.node === selectedNode);
        const fx = nodeForces.length ? parseFloat(nodeForces[0].fx) || 0 : 0;
        const fy = nodeForces.length ? parseFloat(nodeForces[0].fy) || 0 : 0;
        const fz = nodeForces.length ? parseFloat(nodeForces[0].fz) || 0 : 0;
        const mx = parseFloat(container.querySelector('#mc-nema-mx').value) || 0;
        const my = parseFloat(container.querySelector('#mc-nema-my').value) || 0;
        const mz = parseFloat(container.querySelector('#mc-nema-mz').value) || 0;
        svgHtml = generateNemaSvg({
          fx, fy, fz, mx, my, mz,
          de: parseFloat(container.querySelector('#mc-nema-de').value) || 10
        });
      } else if (target === 'mc-slug') {
        svgHtml = generateSlugSvg(currentSlugResolverPayload);
      }
    } catch (e) {
      console.error("SVG Generation error", e);
    }
    svgContainer.innerHTML = svgHtml;
  };

  // Setup live input listeners for SVG
  container.querySelectorAll('input, select').forEach(inp => {
    inp.addEventListener('input', () => {
      const activeTab = container.querySelector('.calc-nav-item.active');
      if (activeTab) updateSvg(activeTab.getAttribute('data-target'));
    });
  });

  // Wire Tab Buttons in Sidebar
  const navItems = container.querySelectorAll('.calc-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      titleEl.textContent = item.textContent;

      navItems.forEach(x => {
        x.classList.remove('active');
        x.style.background = 'transparent';
      });
      item.classList.add('active');
      item.style.background = '#e0f0ff';

      container.querySelectorAll('.panel-content').forEach(x => {
        x.classList.remove('active');
        x.style.display = 'none';
      });
      const panel = container.querySelector('#' + target);
      if (panel) {
        panel.classList.add('active');
        panel.style.display = 'block';
      }

      updateSvg(target);
    });
  });

  // Init SVG
  updateSvg('mc-skirt');

  // Skirt Logic
  container.querySelector('#btn-calc-skirt')?.addEventListener('click', () => {
    const ta = parseFloat(container.querySelector('#mc-skirt-ta').value);
    const t = parseFloat(container.querySelector('#mc-skirt-t').value);
    const k = parseFloat(container.querySelector('#mc-skirt-k').value);
    const h = parseFloat(container.querySelector('#mc-skirt-h').value);

    const calc = getCalculator('mc-skirt');
    const envelope = runCalculation(calc, { ta, t, k, h }, getUnitMode());
    setSession(envelope); appendToHistory(envelope);

    if (envelope.pass && envelope.outputs.profile) {
      let res = `<strong>ΔT = ${envelope.outputs.deltaT} &deg;C</strong><br><br>`;
      res += `<table class="data-table"><thead><tr><th>Distance from Top (x)</th><th>Temp (Tx)</th></tr></thead><tbody>`;
      for (const p of envelope.outputs.profile) {
         res += `<tr><td>${p.x.toFixed(0)} mm</td><td>${p.tx.toFixed(2)} &deg;C</td></tr>`;
      }
      res += `</tbody></table>`;
      container.querySelector('#skirt-results').innerHTML = res;
    }
  });

  // Trunnion Logic
  container.querySelector('#btn-calc-trunnion')?.addEventListener('click', () => {
    const od = parseFloat(container.querySelector('#mc-trun-od').value);
    const wall = parseFloat(container.querySelector('#mc-trun-wall').value);
    const fx = parseFloat(container.querySelector('#mc-trun-fx').value);
    const fy = parseFloat(container.querySelector('#mc-trun-fy').value);
    const fz = parseFloat(container.querySelector('#mc-trun-fz').value);
    const L = parseFloat(container.querySelector('#mc-trun-l')?.value || 300);

    const calc = getCalculator('mc-trunnion');
    const envelope = runCalculation(calc, { od, wall, fx, fy, fz, L }, getUnitMode());
    setSession(envelope); appendToHistory(envelope);

    if (envelope.pass && envelope.outputs) {
      const o = envelope.outputs;
      const i = envelope.intermediateValues;
      const uMode = getUnitMode();
      const stressUnit = uMode === 'Imperial' ? 'psi' : 'MPa';
      let res = `<strong>Section Modulus (Z):</strong> ${i.Z.toFixed(2)} mm³<br>`;
      res += `<strong>Cross Area (A):</strong> ${i.area.toFixed(2)} mm²<br><br>`;
      res += `<strong>Axial Stress (Fx/A):</strong> ${o.axialStress.toFixed(2)} ${stressUnit}<br>`;
      res += `<strong>Shear Stress (V/A):</strong> ${o.shearStress.toFixed(2)} ${stressUnit}<br>`;
      res += `<strong>Bending Stress (V*L/Z):</strong> ${o.bendingStress.toFixed(2)} ${stressUnit}<br>`;
      res += `<strong>Combined Stress:</strong> ${o.combinedStress.toFixed(2)} ${stressUnit}<br>`;
      container.querySelector('#trunnion-results').innerHTML = res;
    }
  });

  // Momentum Calc Logic
  container.querySelector('#btn-calc-momentum')?.addEventListener('click', () => {
    const rows = container.querySelectorAll('#table-momentum tbody tr[data-area]');
    const pipes = [];
    rows.forEach((r, idx) => {
      const area = parseFloat(r.dataset.area);
      const density = parseFloat(r.querySelector('.calc-mom-dens').value);
      const velocity = parseFloat(r.querySelector('.calc-mom-vel').value);
      pipes.push({ area, density, velocity, index: idx });
    });

    const calc = getCalculator('mc-momentum');
    const envelope = runCalculation(calc, { pipes }, getUnitMode());
    setSession(envelope); appendToHistory(envelope);

    if (envelope.pass && envelope.outputs.forces) {
      envelope.outputs.forces.forEach(p => {
        if (p.index !== undefined && rows[p.index]) {
            rows[p.index].querySelector('.calc-mom-force').textContent = p.force.toFixed(2);
        }
      });
    }
  });

  // Flange Leakage Logic
  container.querySelector('#btn-calc-flange')?.addEventListener('click', () => {
     const calc = getCalculator('mc-flange');
     const envelope = runCalculation(calc, { flanges }, getUnitMode());
     setSession(envelope); appendToHistory(envelope);
  });

  // Force Summary Logic
  container.querySelector('#btn-calc-force')?.addEventListener('click', () => {
     const calc = getCalculator('mc-force');
     const envelope = runCalculation(calc, { forces }, getUnitMode());
     setSession(envelope); appendToHistory(envelope);
  });

  // Relief Valve Logic
  container.querySelector('#btn-calc-rv')?.addEventListener('click', () => {
    const pset = parseFloat(container.querySelector('#mc-rv-pset').value) || 0;
    const tf = parseFloat(container.querySelector('#mc-rv-t').value) || 0;
    const k = parseFloat(container.querySelector('#mc-rv-k').value) || 1.4;
    const mw = parseFloat(container.querySelector('#mc-rv-mw').value) || 28;
    const w = parseFloat(container.querySelector('#mc-rv-w').value) || 0;
    const ae = parseFloat(container.querySelector('#mc-rv-ae').value) || 0;
    const pa = parseFloat(container.querySelector('#mc-rv-pa').value) || 14.7;

    const calc = getCalculator('mc-rvforce');
    const unitMode = getUnitMode();
    const envelope = runCalculation(calc, { pset, tf, k, mw, w, ae, pa }, unitMode);
    setSession(envelope); appendToHistory(envelope);

    if (envelope.pass && envelope.outputs) {
      const o = envelope.outputs;
      const pUnit = unitMode === 'SI' ? 'kPa' : unitMode === 'Imperial' ? 'psi' : 'MPa';
      const fUnit = unitMode === 'SI' ? 'N' : unitMode === 'Imperial' ? 'lbf' : 'N';
      let res = `<table class="data-table" style="width:100%;">
        <thead><tr><th>Component</th><th>Value</th><th>Unit</th></tr></thead>
        <tbody>
          <tr><td>Exit Pressure Est. (PE)</td><td>${o.pe_gauge.toFixed(2)}</td><td>${pUnit}</td></tr>
          <tr><td>Momentum Force</td><td>${o.force_momentum.toFixed(2)}</td><td>${fUnit}</td></tr>
          <tr><td>Pressure Force</td><td>${o.force_pressure.toFixed(2)}</td><td>${fUnit}</td></tr>
          <tr style="background:#eef;"><td><strong>Total Open Sys Force</strong></td><td><strong>${o.force_open.toFixed(2)}</strong></td><td><strong>${fUnit}</strong></td></tr>
          <tr style="background:#ffe;"><td><strong>Total Closed Sys Force</strong></td><td><strong>${o.force_closed.toFixed(2)}</strong></td><td><strong>${fUnit}</strong></td></tr>
        </tbody>
      </table>`;
      container.querySelector('#rv-results').innerHTML = res;
    }
  });

  // NEMA SM23 Check Logic
  container.querySelector('#btn-calc-nema')?.addEventListener('click', () => {
    const selectedNode = container.querySelector('#mc-nema-node').value;
    const de = parseFloat(container.querySelector('#mc-nema-de').value) || 10;

    if (!selectedNode) {
      container.querySelector('#nema-results').innerHTML = `<span style="color:red">Please select an anchor node first.</span>`;
      return;
    }

    const nodeForces = forces.filter(f => f.node === selectedNode);
    if (!nodeForces.length) {
      container.querySelector('#nema-results').innerHTML = `<span style="color:red">No force records found for node ${selectedNode}.</span>`;
      return;
    }

    const fData = nodeForces[0];
    const fx = parseFloat(fData.fx) || 0;
    const fy = parseFloat(fData.fy) || 0;
    const fz = parseFloat(fData.fz) || 0;
    const mx = parseFloat(container.querySelector('#mc-nema-mx').value) || 0;
    const my = parseFloat(container.querySelector('#mc-nema-my').value) || 0;
    const mz = parseFloat(container.querySelector('#mc-nema-mz').value) || 0;

    const calc = getCalculator('mc-nema');
    const envelope = runCalculation(calc, { fx, fy, fz, mx, my, mz, de }, getUnitMode());
    setSession(envelope); appendToHistory(envelope);

    if (envelope.pass && envelope.outputs) {
      const o = envelope.outputs;
      let res = `<table class="data-table" style="width:100%;">
        <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Fx, Fy, Fz</td><td>${fx}, ${fy}, ${fz} N</td></tr>
          <tr><td>Mx, My, Mz</td><td>${mx}, ${my}, ${mz} N-m</td></tr>
          <tr><td>Resultant Force (Fr)</td><td>${o.fr_lbf.toFixed(2)} lbf</td></tr>
          <tr><td>Resultant Moment (Mr)</td><td>${o.mr_lbf_ft.toFixed(2)} lbf-ft</td></tr>
          <tr><td>Combined (3F + M)</td><td>${o.combined_load.toFixed(2)}</td></tr>
          <tr><td>Allowable (500 * De)</td><td>${o.allowable.toFixed(2)}</td></tr>
          <tr><td><strong>Ratio</strong></td><td><strong style="color:${o.pass ? 'green' : 'red'}">${o.ratio.toFixed(2)}% (${o.pass ? 'PASS' : 'FAIL'})</strong></td></tr>
        </tbody>
      </table>`;
      container.querySelector('#nema-results').innerHTML = res;
    }
  });

  // Slug Resolve & Calc
  container.querySelector('#btn-slug-resolve')?.addEventListener('click', () => {
     const elId = container.querySelector('#mc-slug-element').value;
     const bendNode = container.querySelector('#mc-slug-bend').value;

     const element = parsed?.elements?.find(e => String(e.id || e.SEQ_NO) === elId) || null;
     const bend = parsed?.bends?.find(b => String(b.node) === bendNode) || null;

     const manualInputs = {
         od: parseFloat(container.querySelector('#mc-slug-od').value) || 0,
         wall: parseFloat(container.querySelector('#mc-slug-wall').value) || 0,
         fluidDensity: parseFloat(container.querySelector('#mc-slug-dens').value) || 0,
         runLength: parseFloat(container.querySelector('#mc-slug-len').value) || 0,
         velocity: parseFloat(container.querySelector('#mc-slug-vel').value) || 0,
         slugLength: parseFloat(container.querySelector('#mc-slug-sluglen').value) || 0,
         daf: parseFloat(container.querySelector('#mc-slug-daf').value) || 2.0,
         lineRef: container.querySelector('#mc-slug-line').value || ""
     };

     const payload = resolveSlugInputs({ element, bend }, manualInputs);
     currentSlugResolverPayload = payload;

     // Render Resolution Table
     let html = `<table class="data-table" style="width:100%; font-size:11px;">
        <thead><tr><th>Field</th><th>Value</th><th>Unit</th><th>Source</th><th>Notes</th></tr></thead>
        <tbody>`;

     for (const [k, v] of Object.entries(payload.resolutionLog)) {
         html += `<tr>
            <td>${v.field}</td>
            <td><strong>${typeof v.value === 'number' ? v.value.toFixed(2) : v.value}</strong></td>
            <td>${v.unit}</td>
            <td><span style="color:${v.sourceType === 'parsed' ? 'green' : v.sourceType === 'linelist' ? 'blue' : 'orange'}">${v.sourceType}</span></td>
            <td>${v.fallbackReason || v.sourcePath}</td>
         </tr>`;
     }
     html += `</tbody></table>`;

     const resTable = container.querySelector('#slug-resolution-table');
     resTable.innerHTML = html;
     resTable.style.display = 'block';

     const btnCalc = container.querySelector('#btn-calc-slug');
     btnCalc.disabled = false;
     btnCalc.classList.replace('btn-secondary', 'btn-primary');

     updateSvg('mc-slug');
  });

  container.querySelector('#btn-calc-slug')?.addEventListener('click', () => {
      if (!currentSlugResolverPayload) return;

      const calc = getCalculator('mc-slug');
      const envelope = runCalculation(calc, currentSlugResolverPayload, getUnitMode());
      setSession(envelope); appendToHistory(envelope);

      if (envelope.pass && envelope.outputs) {
          const o = envelope.outputs;
          const i = envelope.intermediateValues;
          let res = `<strong>Slug Mass:</strong> ${i.slugMass.toFixed(2)} kg<br>`;
          res += `<strong>Steady Flow Force:</strong> ${i.steadyForce.toFixed(2)} N<br>`;
          if (i.f_bend > 0) res += `<strong>Bend Force:</strong> ${i.f_bend.toFixed(2)} N<br>`;
          res += `<br><strong style="color:red; font-size:1.2em;">Amplified Force (DAF): ${o.f_amp.toFixed(2)} N</strong>`;

          container.querySelector('#slug-results').innerHTML = res;
      }
  });

}
