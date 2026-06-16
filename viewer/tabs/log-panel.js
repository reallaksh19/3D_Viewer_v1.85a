import { RuntimeEvents } from '../contracts/runtime-events.js';
/**
 * log-panel.js — Collapsible bottom-docked detail log panel for diagnostics.
 */

import { logs, SEVERITY, CATEGORY, resolveLog, clearLogs, subscribe } from '../core/logger.js';
import { emit } from '../core/event-bus.js';

let _container = null;
let _isExpanded = false;
let _isHalfExpanded = false;
let _currentFilter = 'All';
let _currentSearch = '';
let _unsubscribe = null;
let _height = '200px';

export function renderLogPanel(parentElement) {
  _container = document.createElement('div');
  _container.id = 'detail-log-panel';
  _container.className = 'log-panel collapsed';

  // Load state
  try {
      const savedHeight = localStorage.getItem('log-panel-height');
      if (savedHeight) _height = savedHeight;
      const savedState = localStorage.getItem('log-panel-state');
      if (savedState === 'half') _isHalfExpanded = true;
      if (savedState === 'full') _isExpanded = true;
  } catch (e) {}

  parentElement.appendChild(_container);

  _unsubscribe = subscribe(() => _updateDOM());
  _updateDOM();

  // Resizer drag logic
  const resizer = _container.querySelector('.log-panel-resizer');
  if (resizer) {
      let startY, startHeight;
      resizer.addEventListener('mousedown', (e) => {
          startY = e.clientY;
          startHeight = parseInt(document.defaultView.getComputedStyle(_container).height, 10);
          document.documentElement.addEventListener('mousemove', doDrag, false);
          document.documentElement.addEventListener('mouseup', stopDrag, false);
      });

      function doDrag(e) {
          if (!_isExpanded && !_isHalfExpanded) return;
          const deltaY = startY - e.clientY;
          const newHeight = startHeight + deltaY;
          _height = `${Math.max(100, newHeight)}px`;
          _container.style.height = _height;
      }

      function stopDrag() {
          document.documentElement.removeEventListener('mousemove', doDrag, false);
          document.documentElement.removeEventListener('mouseup', stopDrag, false);
          try { localStorage.setItem('log-panel-height', _height); } catch(e){}
      }
  }
}

export function destroyLogPanel() {
  if (_unsubscribe) _unsubscribe();
  if (_container && _container.parentElement) {
    _container.parentElement.removeChild(_container);
  }
}

function _updateDOM() {
  if (!_container) return;

  const errCount = logs.filter(l => l.severity === SEVERITY.ERROR).length;
  const warnCount = logs.filter(l => l.severity === SEVERITY.WARNING).length;
  const infoCount = logs.filter(l => l.severity === SEVERITY.INFO).length;
  const unresCount = logs.filter(l => !l.resolved).length;

  const filteredLogs = logs.filter(l => {
      if (_currentFilter !== 'All' && l.severity !== _currentFilter && l.category !== _currentFilter) return false;
      if (_currentSearch) {
          const s = _currentSearch.toLowerCase();
          return (l.message?.toLowerCase().includes(s) ||
                  l.lineNo?.toString().includes(s) ||
                  l.componentType?.toLowerCase().includes(s) ||
                  l.propertyName?.toLowerCase().includes(s));
      }
      return true;
  });

  const headerHtml = `
    <div class="log-panel-resizer"></div>
    <div class="log-panel-header">
      <div class="log-counts">
        <span class="log-badge error" title="Errors">${errCount}</span>
        <span class="log-badge warning" title="Warnings">${warnCount}</span>
        <span class="log-badge info" title="Info">${infoCount}</span>
        <span class="log-unresolved">${unresCount} Unresolved</span>
      </div>
      <div class="log-actions">
        ${_isExpanded || _isHalfExpanded ? `
            <button class="btn-small" id="log-clear-btn">Clear</button>
            <button class="btn-small" id="log-export-btn">Export</button>
        ` : ''}
        <button class="btn-small" id="log-toggle-btn">${_isExpanded ? 'Collapse' : (_isHalfExpanded ? 'Expand Full' : 'Expand')}</button>
      </div>
    </div>
  `;

  let contentHtml = '';

  if (_isExpanded || _isHalfExpanded) {
    contentHtml = `
      <div class="log-filters">
        <select id="log-filter-sel">
          <option value="All" ${_currentFilter === 'All' ? 'selected' : ''}>All Categories</option>
          <option value="error" ${_currentFilter === 'error' ? 'selected' : ''}>Errors</option>
          <option value="warning" ${_currentFilter === 'warning' ? 'selected' : ''}>Warnings</option>
          ${Object.values(CATEGORY).map(c => `<option value="${c}" ${_currentFilter === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
        </select>
        <input type="text" id="log-search-inp" placeholder="Search logs..." value="${_currentSearch}">
      </div>
      <div class="log-content-area">
        <div class="log-list">
          ${filteredLogs.reverse().map(l => _renderLogRow(l)).join('')}
        </div>
        ${_isExpanded ? `<div class="log-detail-pane" id="log-detail-pane">Select an issue for details</div>` : ''}
      </div>
    `;
  }

  _container.innerHTML = headerHtml + contentHtml;
  _container.className = `log-panel ${_isExpanded ? 'expanded' : (_isHalfExpanded ? 'half-expanded' : 'collapsed')}`;

  if (_isExpanded || _isHalfExpanded) {
      _container.style.height = _isExpanded ? _height : '150px';
  } else {
      _container.style.height = 'auto'; // let CSS handle collapsed height
  }

  _bindEvents();
}

function _renderLogRow(log) {
  const icon = log.severity === SEVERITY.ERROR ? '🔴' : log.severity === SEVERITY.WARNING ? '🟡' : '🔵';
  return `
    <div class="log-row ${log.resolved ? 'resolved' : ''} ${log.severity}" data-id="${log.id}">
      <span class="log-icon">${icon}</span>
      <span class="log-cat">[${log.category}]</span>
      <span class="log-ref">${log.lineNo ? `[Line ${log.lineNo}]` : (log.objectId ? `[ID ${log.objectId}]` : '')}</span>
      <span class="log-msg">${log.message}</span>
    </div>
  `;
}

function _bindEvents() {
  const toggleBtn = _container.querySelector('#log-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        if (!_isExpanded && !_isHalfExpanded) {
            _isHalfExpanded = true;
        } else if (_isHalfExpanded) {
            _isHalfExpanded = false;
            _isExpanded = true;
        } else {
            _isExpanded = false;
            _isHalfExpanded = false;
        }
        _saveState();
        _updateDOM();
    });
  }

  const clearBtn = _container.querySelector('#log-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearLogs);

  const filterSel = _container.querySelector('#log-filter-sel');
  if (filterSel) {
      filterSel.addEventListener('change', (e) => {
          _currentFilter = e.target.value;
          _updateDOM();
      });
  }

  const searchInp = _container.querySelector('#log-search-inp');
  if (searchInp) {
      searchInp.addEventListener('input', (e) => {
          _currentSearch = e.target.value;
          _updateDOM();
      });
  }

  const rows = _container.querySelectorAll('.log-row');
  rows.forEach(r => {
      r.addEventListener('click', () => {
          rows.forEach(rx => rx.classList.remove('selected'));
          r.classList.add('selected');
          _showDetail(r.dataset.id);
      });
  });
}

function _showDetail(id) {
    if (!_isExpanded) return;
    const pane = _container.querySelector('#log-detail-pane');
    if (!pane) return;

    const log = logs.find(l => l.id === id);
    if (!log) return;

    pane.innerHTML = `
        <div class="log-detail-header">
            <h4>${log.severity.toUpperCase()} Issue: ${log.category}</h4>
            <button class="btn-small" id="log-resolve-btn" data-id="${log.id}">${log.resolved ? 'Unresolve' : 'Mark Resolved'}</button>
            <button class="btn-small" id="log-jump-btn" data-id="${log.objectId || log.rowId}">Jump to Target</button>
        </div>
        <div class="log-detail-body">
            <p><strong>Message:</strong> ${log.message}</p>
            ${log.ruleText ? `<p><strong>Rule violated:</strong> ${log.ruleText}</p>` : ''}
            ${log.expectedValue ? `<p><strong>Expected:</strong> ${log.expectedValue}</p>` : ''}
            ${log.actualValue ? `<p><strong>Actual:</strong> ${log.actualValue}</p>` : ''}
            <div class="log-meta">
                ${log.objectId ? `<span>Object ID: ${log.objectId}</span>` : ''}
                ${log.lineNo ? `<span>Line No: ${log.lineNo}</span>` : ''}
                ${log.componentType ? `<span>Component: ${log.componentType}</span>` : ''}
            </div>
        </div>
    `;

    pane.querySelector('#log-resolve-btn')?.addEventListener('click', (e) => {
        const tgtLog = logs.find(l => l.id === id);
        if (tgtLog) {
            tgtLog.resolved = !tgtLog.resolved;
            emit(RuntimeEvents.LOG_RESOLVED, tgtLog);
            _updateDOM();
        }
    });

    pane.querySelector('#log-jump-btn')?.addEventListener('click', () => {
        if (log.objectId || log.rowId) {
            emit(RuntimeEvents.JUMP_TO_OBJECT, log.objectId || log.rowId);
        }
    });
}

function _saveState() {
    try {
        let stateStr = 'collapsed';
        if (_isHalfExpanded) stateStr = 'half';
        if (_isExpanded) stateStr = 'full';
        localStorage.setItem('log-panel-state', stateStr);
    } catch(e) {}
}
