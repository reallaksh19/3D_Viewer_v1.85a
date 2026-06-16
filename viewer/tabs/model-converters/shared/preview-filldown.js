// Group-wise fill-down helpers for XML->CII Preview.
//
// Behaviour intentionally differs from plain Excel Ctrl+D:
// - Fill starts at the clicked/source row.
// - Manual/original values below the source act as boundaries and become the new source.
// - Blank cells and previous auto-filled cells are overwritten.
// - A user edit to an auto-filled cell promotes that cell to a manual boundary.
//
// Metadata is stored under overrides.__previewFillDown so old configs remain valid.
// Existing overrides with no metadata are treated as manual to avoid destructive overwrites.

const FILL_META_KEY = '__previewFillDown';
const OVERRIDE_CATEGORIES = ['pipingClass', 'material', 'materialCode', 'rating', 'wallThickness', 'corrosion'];

function text(value) {
  return String(value ?? '').trim();
}

function ensureFillMeta(overrides) {
  if (!overrides[FILL_META_KEY] || typeof overrides[FILL_META_KEY] !== 'object') {
    overrides[FILL_META_KEY] = { processData: {} };
  }
  if (!overrides[FILL_META_KEY].processData || typeof overrides[FILL_META_KEY].processData !== 'object') {
    overrides[FILL_META_KEY].processData = {};
  }
  for (const category of OVERRIDE_CATEGORIES) {
    if (!overrides[FILL_META_KEY][category] || typeof overrides[FILL_META_KEY][category] !== 'object') {
      overrides[FILL_META_KEY][category] = {};
    }
  }
  return overrides[FILL_META_KEY];
}

function processFieldMeta(meta, field) {
  if (!meta.processData[field] || typeof meta.processData[field] !== 'object') meta.processData[field] = {};
  return meta.processData[field];
}

function setProcessState(meta, field, lineKey, fillState, sourceKey = null) {
  if (!lineKey) return;
  const bucket = processFieldMeta(meta, field);
  bucket[lineKey] = { fillState, sourceKey, updatedAt: new Date().toISOString() };
}

function setOverrideState(meta, category, key, fillState, sourceKey = null) {
  if (!key) return;
  if (!meta[category] || typeof meta[category] !== 'object') meta[category] = {};
  meta[category][key] = { fillState, sourceKey, updatedAt: new Date().toISOString() };
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function sortedByPreviewRow(elements, attrName) {
  return [...elements].sort((a, b) => Number(a.getAttribute(attrName) || 0) - Number(b.getAttribute(attrName) || 0));
}

function overrideCategoryForField(field) {
  if (field === 'pipingClass') return 'pipingClass';
  if (field === 'materialCode') return 'materialCode';
  if (field === 'material') return 'material';
  if (field === 'rating') return 'rating';
  if (field === 'wallThickness') return 'wallThickness';
  if (field === 'corrosion') return 'corrosion';
  return field;
}

function keyForOverrideCell(field, cell) {
  if (field === 'pipingClass') return text(cell?.getAttribute('data-mc-edit-derived'));
  return text(cell?.getAttribute('data-mc-edit-key') || cell?.getAttribute('data-mc-edit-mat'));
}

function valueFromOverrideCell(cell) {
  const value = text(cell?.querySelector('.mc-preview-editable-val')?.textContent);
  return value === '—' ? '' : value;
}

function inferOverrideFillState({ metaBucket, overridesBucket, key, visibleValue }) {
  const state = metaBucket?.[key]?.fillState;
  if (state === 'manual' || state === 'auto' || state === 'blank') return state;
  if (hasOwn(overridesBucket, key)) return 'manual';
  if (visibleValue && visibleValue !== '—') return 'manual';
  return 'blank';
}

function inferProcessFillState({ metaBucket, overrides, lineKey, field, cell, value }) {
  const state = metaBucket?.[lineKey]?.fillState;
  if (state === 'manual' || state === 'auto' || state === 'blank') return state;
  if (hasOwn(overrides.processData?.[lineKey], field)) return 'manual';
  if (cell?.classList?.contains('mc-preview-pd-linelist') && text(value)) return 'manual';
  return text(value) ? 'manual' : 'blank';
}

export function markPreviewOverrideManual({ config, ensureOverrides, field, key, value }) {
  const overrides = ensureOverrides(config);
  const meta = ensureFillMeta(overrides);
  const category = overrideCategoryForField(field);
  const cleanValue = text(value);
  if (!overrides[category] || typeof overrides[category] !== 'object') overrides[category] = {};
  if (cleanValue) setOverrideState(meta, category, key, 'manual', null);
  else setOverrideState(meta, category, key, 'blank', null);
}

export function markPreviewProcessManual({ config, ensureOverrides, field, lineKey, value }) {
  const overrides = ensureOverrides(config);
  const meta = ensureFillMeta(overrides);
  const cleanValue = text(value);
  if (cleanValue) setProcessState(meta, field, lineKey, 'manual', null);
  else setProcessState(meta, field, lineKey, 'blank', null);
}

export function applyPreviewOverrideFillDown({ host, config, ensureOverrides, field, fromRow, currentValue }) {
  const sourceValueInitial = text(currentValue);
  if (!sourceValueInitial || sourceValueInitial === '—') return 0;

  const overrides = ensureOverrides(config);
  const meta = ensureFillMeta(overrides);
  const category = overrideCategoryForField(field);
  const bucket = overrides[category] || {};
  const metaBucket = meta[category] || {};

  let sourceValue = sourceValueInitial;
  let sourceKey = '';
  let filled = 0;
  const cells = sortedByPreviewRow(host.querySelectorAll(`[data-mc-edit-type="${field}"]`), 'data-mc-edit-row');

  for (const cell of cells) {
    const rowIndex = Number(cell.getAttribute('data-mc-edit-row') || 0);
    const key = keyForOverrideCell(field, cell);
    if (!key) continue;

    if (rowIndex === fromRow) {
      sourceKey = key;
      setOverrideState(meta, category, key, 'manual', null);
      if (!overrides[category]) overrides[category] = {};
      overrides[category][key] = sourceValue;
      continue;
    }
    if (rowIndex < fromRow) continue;

    const visibleValue = valueFromOverrideCell(cell);
    const fillState = inferOverrideFillState({ metaBucket, overridesBucket: bucket, key, visibleValue });
    if (fillState === 'manual') {
      sourceValue = visibleValue;
      sourceKey = key;
      continue;
    }

    if (!overrides[category]) overrides[category] = {};
    overrides[category][key] = sourceValue;
    setOverrideState(meta, category, key, 'auto', sourceKey);

    const valSpan = cell.querySelector('.mc-preview-editable-val');
    if (valSpan) valSpan.textContent = sourceValue;
    const badge = cell.querySelector('.mc-preview-badge');
    if (badge) {
      badge.textContent = '✓ auto-fill';
      badge.className = 'mc-preview-badge exact';
    }
    cell.dataset.mcFillState = 'auto';
    filled += 1;
  }
  return filled;
}

export function applyPreviewProcessFillDown({ host, config, ensureOverrides, field, fromRow, currentValue }) {
  const sourceValueInitial = text(currentValue);
  if (!sourceValueInitial) return 0;
  const overrides = ensureOverrides(config);
  if (!overrides.processData || typeof overrides.processData !== 'object') overrides.processData = {};
  const meta = ensureFillMeta(overrides);
  const fieldMeta = processFieldMeta(meta, field);
  let sourceValue = sourceValueInitial;
  let sourceKey = '';
  let filled = 0;
  const inputs = sortedByPreviewRow([...host.querySelectorAll('[data-mc-pd-field]')].filter((input) => input.dataset.mcPdField === field), 'data-mc-pd-row');

  for (const input of inputs) {
    const rowIndex = Number(input.getAttribute('data-mc-pd-row') || 0);
    const lineKey = text(input.getAttribute('data-mc-pd-linekey'));
    if (!lineKey) continue;

    if (rowIndex === fromRow) {
      sourceKey = lineKey;
      setProcessState(meta, field, lineKey, 'manual', null);
      if (!overrides.processData[lineKey]) overrides.processData[lineKey] = {};
      overrides.processData[lineKey][field] = sourceValue;
      continue;
    }
    if (rowIndex < fromRow) continue;

    const cell = input.closest('.mc-preview-pd-cell');
    const fillState = inferProcessFillState({ metaBucket: fieldMeta, overrides, lineKey, field, cell, value: input.value });
    if (fillState === 'manual') {
      sourceValue = text(input.value);
      sourceKey = lineKey;
      continue;
    }

    if (!overrides.processData[lineKey]) overrides.processData[lineKey] = {};
    overrides.processData[lineKey][field] = sourceValue;
    setProcessState(meta, field, lineKey, 'auto', sourceKey);
    input.value = sourceValue;
    input.dataset.mcFillState = 'auto';
    filled += 1;
  }
  return filled;
}
