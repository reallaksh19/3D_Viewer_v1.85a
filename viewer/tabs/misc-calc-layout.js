export function renderMiscCalcLayout(container) {
  container.innerHTML = `
    <div class="misc-calc-container" style="display: flex; height: calc(100vh - 120px); font-family: sans-serif;">

      <!-- Left Rail: Calculator List -->
      <div class="calc-sidebar" style="width: 250px; border-right: 1px solid #ccc; background: #f9f9f9; padding: 10px; overflow-y: auto;">
        <h4 style="margin-top: 0;">Calculators</h4>
        <ul class="calc-nav-list" style="list-style: none; padding: 0; margin: 0;">
          <li class="calc-nav-item active" data-target="mc-skirt" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; background: #e0f0ff;">Vessel Skirt Temp</li>
          <li class="calc-nav-item" data-target="mc-trunnion" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">Trunnion Calc</li>
          <li class="calc-nav-item" data-target="mc-momentum" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">Momentum Calc</li>
          <li class="calc-nav-item" data-target="mc-flange" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">Flange Leakage</li>
          <li class="calc-nav-item" data-target="mc-force" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">Force Summary</li>
          <li class="calc-nav-item" data-target="mc-rvforce" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">Relief Valve Forces</li>
          <li class="calc-nav-item" data-target="mc-nema" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">NEMA SM23 Check</li>
          <li class="calc-nav-item" data-target="mc-slug" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; font-weight: bold; color: #1a5fa3;">Slug Loads</li>
        </ul>
      </div>

      <!-- Main Content Area -->
      <div class="calc-main" style="flex: 1; display: flex; flex-direction: column;">

        <!-- Header Controls -->
        <div class="calc-header" style="padding: 10px 20px; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; background: #fff;">
          <h3 id="calc-title" style="margin: 0;">Vessel Skirt Temp</h3>
          <div>
            <label for="mc-unit-mode" style="margin-right: 10px; font-weight: bold;">Unit Mode:</label>
            <select id="mc-unit-mode" style="padding: 4px; border-radius: 4px;">
              <option value="Native" selected>Native</option>
              <option value="SI">SI</option>
              <option value="Imperial">Imperial</option>
            </select>
          </div>
        </div>

        <!-- Center / Right Split -->
        <div class="calc-body" style="flex: 1; display: flex; overflow: hidden;">

          <!-- Center: Inputs & Results -->
          <div class="calc-inputs-results" style="flex: 1; padding: 20px; overflow-y: auto; background: #fff;">
            <div id="calc-panels">
              <!-- Panels injected here -->
            </div>
          </div>

          <!-- Right: Dynamic SVG -->
          <div class="calc-svg-panel" style="width: 350px; border-left: 1px solid #ccc; background: #fafafa; padding: 20px; display: flex; flex-direction: column;">
            <h4 style="margin-top: 0; text-align: center;">Engineering Sketch</h4>
            <div id="svg-container" style="flex: 1; border: 1px dashed #bbb; background: #fff; display: flex; align-items: center; justify-content: center;">
              <span style="color: #888;">[SVG Placeholder]</span>
            </div>
          </div>
        </div>

        <!-- Bottom: Console -->
        <div id="misc-calc-console-container" style="height: 200px; border-top: 1px solid #ccc; background: #1e1e1e; overflow: hidden;">
        </div>

      </div>
    </div>
  `;
}
