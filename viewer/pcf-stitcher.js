/**
 * pcf-stitcher.js — Stitch component endpoints together and log gaps/warnings
 * Ported from 3Dmodelgeneratorforpcf_Stitcher.js (React) to vanilla JS.
 *
 * Exports:
 *   Stitcher class
 */

export class Stitcher {
    constructor(tolerance = 6.0) {
        this.tolerance = tolerance;
        this.logs = [];
    }

    /** @private */
    _log(msg, type = 'INFO') {
        this.logs.push({
            timestamp: new Date().toISOString(),
            type,
            message: msg,
        });
    }

    /**
     * Process parsed components: snap nearby endpoints and log gaps.
     * @param {object[]} rawComponents — from parsePcf()
     * @returns {{ components: object[], logs: object[] }}
     */
    process(rawComponents) {
        this.logs = [];
        this._log(`Starting stitch for ${rawComponents.length} components. Gap Tolerance: ${this.tolerance}mm (Visual Only)`);

        // Deep clone to avoid mutating originals
        const comps = JSON.parse(JSON.stringify(rawComponents));

        // Distance squared helper
        const distSq = (p1, p2) =>
            (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;

        // Pass 1: Build connection lists (using explicit references to allow mutation)
        comps.forEach((c, idx) => {
            c._idx = idx;
            c.connections = [];

            if (c.points) {
                c.points.forEach((p, i) => {
                    c.connections.push({
                        x: p.x, y: p.y, z: p.z,
                        type: 'END', index: i, ref: p
                    });
                });
            }
            if (c.centrePoint) {
                c.connections.push({
                    x: c.centrePoint.x, y: c.centrePoint.y, z: c.centrePoint.z,
                    type: 'CENTRE', ref: c.centrePoint
                });
            }
            if (c.branch1Point) {
                c.connections.push({
                    x: c.branch1Point.x, y: c.branch1Point.y, z: c.branch1Point.z,
                    type: 'BRANCH', ref: c.branch1Point
                });
            }
            if (c.coOrds) {
                c.connections.push({
                    x: c.coOrds.x, y: c.coOrds.y, z: c.coOrds.z,
                    type: 'CO-ORDS', ref: c.coOrds
                });
            }
        });

        // Pass 2: Connectivity — snap nearby endpoints
        const unmatchedPoints = [];
        const tolSq = this.tolerance ** 2;

        comps.forEach(c1 => {
            c1.connections.forEach(p1 => {
                let matchFound = false;

                for (const c2 of comps) {
                    if (c1.id === c2.id) continue;

                    for (const p2 of c2.connections) {
                        const d2 = distSq(p1, p2);
                        if (d2 < 0.001) {
                            matchFound = true;
                            break;
                        } else if (d2 <= tolSq) {
                            matchFound = true;
                            this._log(
                                `Gap bridged: ${Math.sqrt(d2).toFixed(2)}mm between ${c1.type}#${c1._idx} and ${c2.type}#${c2._idx}`,
                                'WARN'
                            );
                            // 3D Smart Fixer Architecture Update:
                            // We NO LONGER snap or mutate raw PCF geometry during Phase 3 viewer generation.
                            // The 3D Viewer must reflect exactly what the PCF data contains, without visual masking.
                            // The solver phase (Phase 2) handles structural integrity.
                            break;
                        }
                    }
                    if (matchFound) break;
                }

                if (!matchFound) {
                    unmatchedPoints.push({ component: c1, point: p1 });
                }
            });
        });

        this._log(`Found ${unmatchedPoints.length} terminal points.`);
        this._log(`Stitch complete. ${comps.length} components processed.`, 'SUCCESS');

        return {
            components: comps,
            logs: this.logs,
        };
    }
}
