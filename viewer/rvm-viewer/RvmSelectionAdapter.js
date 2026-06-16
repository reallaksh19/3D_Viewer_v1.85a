import * as THREE from 'three';

import { emit } from '../core/event-bus.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';

const COLORS = {
    SELECTED: 0x2244cc,
    SEARCH_RESULT: 0x884400,
    CLEAR: 0x000000
};

export class RvmSelectionAdapter {
    constructor(modelGroup, camera, domElement, identityMap) {
        this.modelGroup = modelGroup;
        this.camera = camera;
        this.domElement = domElement;
        this.identityMap = identityMap;

        this._selectedCanonicalId = null;
        this._selectedCanonicalIds = []; // multi-select
        this._selectedRenderIds = [];

        this._originalMaterials = new Map(); // renderId -> original emissive/color

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this._onPointerDown = this._onPointerDown.bind(this);
        this.domElement.addEventListener('pointerdown', this._onPointerDown);
    }

    updateModelGroup(modelGroup) {
        this.clearSelection();
        this.modelGroup = modelGroup;
        this._originalMaterials.clear();
    }

    _onPointerDown(event) {
        if (event.button !== 0) return; // Only left click

        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.modelGroup, true);

        const isModifier = event.ctrlKey || event.shiftKey || event.metaKey;

        if (intersects.length > 0) {
            // Find the first mesh intersect
            const hit = intersects.find(i => i.object.isMesh && i.object.visible);
            if (hit) {
                const mesh = hit.object;
                const renderId = mesh.userData?.name || mesh.name || mesh.uuid;
                this._handlePick(renderId, isModifier);
                return;
            }
        }

        // If clicked on nothing, clear selection unless modifier is pressed
        if (!isModifier) {
            this.clearSelection();
            emit(RuntimeEvents.RVM_NODE_SELECTED, { canonicalId: null, canonicalIds: [], renderObjectIds: [] });
        }
    }

    _handlePick(renderId, additive = false) {
        let canonicalId = null;
        if (this.identityMap) {
            canonicalId = this.identityMap.canonicalFromRender?.(renderId);
        }
        canonicalId = canonicalId || renderId; // fallback

        if (additive) {
            this.toggleCanonicalId(canonicalId);
        } else {
            this.selectByCanonicalId(canonicalId);
        }
    }

    selectByCanonicalId(canonicalId, options = {}) {
        this.clearSelection();
        this._selectedCanonicalId = canonicalId;
        this._selectedCanonicalIds = [canonicalId];

        if (this.identityMap) {
            this._selectedRenderIds = this.identityMap.renderIdsFromCanonical(canonicalId) || [canonicalId];
        } else {
            this._selectedRenderIds = [canonicalId];
        }

        this._highlight(this._selectedRenderIds, COLORS.SELECTED);
        this._emitSelection();
    }

    selectCanonicalIds(ids, options = {}) {
        if (!options.additive) {
            this.clearSelection();
        }
        for (const id of ids) {
            if (!this._selectedCanonicalIds.includes(id)) {
                this._selectedCanonicalIds.push(id);
            }
        }
        this._selectedCanonicalId = this._selectedCanonicalIds[0] || null;
        this._rebuildRenderIds();
        this._highlight(this._selectedRenderIds, COLORS.SELECTED);
        this._emitSelection();
    }

    toggleCanonicalId(id) {
        const idx = this._selectedCanonicalIds.indexOf(id);
        if (idx >= 0) {
            this._selectedCanonicalIds.splice(idx, 1);
            // Restore material for the removed id before rebuilding
        } else {
            this._selectedCanonicalIds.push(id);
        }
        this._selectedCanonicalId = this._selectedCanonicalIds[0] || null;
        this._restoreMaterials();
        this._rebuildRenderIds();
        this._highlight(this._selectedRenderIds, COLORS.SELECTED);
        this._emitSelection();
    }

    _rebuildRenderIds() {
        this._selectedRenderIds = [];
        for (const cId of this._selectedCanonicalIds) {
            const rIds = this.identityMap?.renderIdsFromCanonical(cId) || [cId];
            this._selectedRenderIds.push(...rIds);
        }
    }

    _emitSelection() {
        const primaryId = this._selectedCanonicalId;
        emit(RuntimeEvents.RVM_NODE_SELECTED, {
            canonicalId: primaryId,
            canonicalIds: [...this._selectedCanonicalIds],
            renderObjectIds: [...this._selectedRenderIds]
        });
    }

    getSelectedCanonicalId() {
        return this._selectedCanonicalId;
    }

    getSelectedCanonicalIds() {
        return [...this._selectedCanonicalIds];
    }

    highlightSearchResults(canonicalIds) {
        // We might need to keep selection and search separate if they overlap,
        // but for now, color the search results.
        const renderIds = [];
        for (const cId of canonicalIds) {
            const rIds = this.identityMap?.renderIdsFromCanonical(cId) || [cId];
            renderIds.push(...rIds);
        }
        this._highlight(renderIds, COLORS.SEARCH_RESULT);
    }

    clearSelection(options = {}) {
        this._restoreMaterials();
        this._selectedCanonicalId = null;
        this._selectedCanonicalIds = [];
        this._selectedRenderIds = [];
    }

    getSelectionRenderIds() {
        return this._selectedRenderIds;
    }

    _highlight(renderIds, colorHex) {
        const renderIdSet = new Set(renderIds);


        this.modelGroup.traverse((obj) => {
            if (obj.isMesh) {
                const name = obj.userData?.name || obj.name || obj.uuid;
                if (renderIdSet.has(name)) {
                    this._setEmissive(obj, colorHex);
                }
            }
        });
    }

    _setEmissive(mesh, colorHex) {
        if (!mesh.material) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];


        const renderId = mesh.userData?.name || mesh.name || mesh.uuid;

        if (!this._originalMaterials.has(renderId)) {
            const ogs = materials.map(m => {
                if (m.emissive) return m.emissive.getHex();
                return null;
            });
            this._originalMaterials.set(renderId, ogs);
        }

        for (const m of materials) {
            if (m.emissive) {
                m.emissive.set(colorHex);
            }
        }
    }

    _restoreMaterials() {
        this.modelGroup.traverse((obj) => {
            if (obj.isMesh) {
                const renderId = obj.userData?.name || obj.name || obj.uuid;
                if (this._originalMaterials.has(renderId)) {
                    const ogs = this._originalMaterials.get(renderId);
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];


                    for (let i = 0; i < materials.length; i++) {
                        const m = materials[i];
                        // Only restore when we have a recorded original; don't clobber with CLEAR
                        // for materials whose original emissive was never stored.
                        if (m.emissive && ogs[i] !== null) {
                            m.emissive.setHex(ogs[i]);
                        }
                    }
                }
            }
        });
        this._originalMaterials.clear();
    }

    dispose() {
        this.clearSelection();
        this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    }
}
