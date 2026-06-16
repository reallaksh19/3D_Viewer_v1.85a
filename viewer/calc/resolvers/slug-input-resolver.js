import { getLinelistService } from '../../core/linelist-store.js';
import { computeOperatingConditions } from '../../utils/max-finder.js';
import { state } from '../../core/state.js';
import { getCaesarMatchAttribute } from '../../core/settings.js';

function createProvenance(field, value, unit, sourceType, sourcePath, matchedLine, format, fallbackReason, confidence) {
    return {
        field, value, unit, sourceType, sourcePath, matchedLine, sourceFormat: format, fallbackReason, confidence
    };
}

/**
 * Resolve line reference string from an element, supporting:
 *  - XML elements: el.lineNo (set directly during xml-graph-builder)
 *  - PCF components: el.attributes['PIPELINE-REFERENCE'] or el.attributes['LINE_NO']
 *  - Interchange/RVM: el.lineNo or el.pipelineRef
 *  - Manual fallback: settings.caesarMatchAttribute as direct property key
 */
function _resolveLineRef(element, matchAttr) {
    if (!element) return null;

    // 1. Direct property (XML native elements, RVM elements)
    if (element[matchAttr]) return String(element[matchAttr]).trim();

    // 2. PCF component attributes bag (parsePcf output)
    if (element.attributes) {
        const a = element.attributes;
        const fromAttr = a['PIPELINE-REFERENCE'] || a['LINE_NO'] || a['LINE-NAME'] || a['LINE-REF'] || a['PIPELINE_REFERENCE'];
        if (fromAttr) return String(fromAttr).trim();
    }

    // 3. Common aliased properties across different parsers
    const aliases = ['lineNo', 'pipelineRef', 'lineRef', 'pipeline_ref', 'PIPELINE_REFERENCE', 'LINE_NO'];
    for (const alias of aliases) {
        if (alias !== matchAttr && element[alias]) return String(element[alias]).trim();
    }

    return null;
}

export function resolveSlugInputs(basis, manualInputs) {
    const { element, bend, nodeId } = basis;
    const format = state.parsed?.format || 'UNKNOWN';
    const llService = getLinelistService();
    const globalOps = computeOperatingConditions(state.parsed) || {};

    const resolved = {};
    const assumptions = [];
    const resolutionLog = {};

    let lineRef = manualInputs.lineRef;
    let matchedLine = null;
    const matchAttr = getCaesarMatchAttribute();

    const resolvedLineRef = _resolveLineRef(element, matchAttr);
    if (resolvedLineRef) lineRef = resolvedLineRef;

    const llAttrs = lineRef ? llService.getSmartAttributes(lineRef) : null;
    if (llAttrs && llAttrs.Found) {
        matchedLine = lineRef;
    }

    // Geometry Fields (OD, wall, runLength, bendAngle, bendRadius)
    // Parsed > Manual
    if (element && element.od) {
        resolved.od = element.od;
        resolutionLog.od = createProvenance("od", element.od, "mm", "parsed", `element[${element.id || element.SEQ_NO}]`, matchedLine, format, "", "high");
    } else {
        resolved.od = manualInputs.od;
        resolutionLog.od = createProvenance("od", manualInputs.od, "mm", "manual", "user input", matchedLine, format, "parsed od missing", "medium");
    }

    if (element && element.wall) {
        resolved.wall = element.wall;
        resolutionLog.wall = createProvenance("wall", element.wall, "mm", "parsed", `element[${element.id || element.SEQ_NO}]`, matchedLine, format, "", "high");
    } else {
        resolved.wall = manualInputs.wall;
        resolutionLog.wall = createProvenance("wall", manualInputs.wall, "mm", "manual", "user input", matchedLine, format, "parsed wall missing", "medium");
    }

    resolved.id = resolved.od - (2 * resolved.wall);
    resolved.area = (Math.PI / 4) * Math.pow(resolved.id / 1000, 2);

    if (element && element.dx !== undefined) {
        const len = Math.sqrt(element.dx**2 + element.dy**2 + element.dz**2);
        resolved.runLength = len;
        resolutionLog.runLength = createProvenance("runLength", len, "mm", "parsed", `element[${element.id || element.SEQ_NO}]`, matchedLine, format, "", "high");
    } else {
        resolved.runLength = manualInputs.runLength;
        resolutionLog.runLength = createProvenance("runLength", manualInputs.runLength, "mm", "manual", "user input", matchedLine, format, "parsed length missing", "medium");
    }

    if (bend) {
        resolved.bendAngle = bend.angle || 90;
        resolutionLog.bendAngle = createProvenance("bendAngle", resolved.bendAngle, "deg", "parsed", `bend[${bend.node}]`, matchedLine, format, bend.angle ? "" : "assumed 90 deg", bend.angle ? "high" : "low");
        if (!bend.angle) assumptions.push("bendAngle defaulted to 90 deg");

        resolved.bendRadius = bend.radius || (resolved.od * 1.5);
        resolutionLog.bendRadius = createProvenance("bendRadius", resolved.bendRadius, "mm", "parsed", `bend[${bend.node}]`, matchedLine, format, bend.radius ? "" : "assumed 1.5D", bend.radius ? "high" : "low");
        if (!bend.radius) assumptions.push("bendRadius defaulted to 1.5D");
    } else {
        resolved.bendAngle = manualInputs.bendAngle || 90;
        resolutionLog.bendAngle = createProvenance("bendAngle", resolved.bendAngle, "deg", "manual", "user input", matchedLine, format, "no parsed bend", "medium");
        if (!manualInputs.bendAngle) assumptions.push("bendAngle defaulted to 90 deg");

        resolved.bendRadius = manualInputs.bendRadius || 0;
        resolutionLog.bendRadius = createProvenance("bendRadius", resolved.bendRadius, "mm", "manual", "user input", matchedLine, format, "no parsed bend", "medium");
    }

    // Process Fields (fluidDensity, T1, P1)
    // Parsed > Linelist > Manual
    if (element && element.fluidDensity) {
        resolved.fluidDensity = element.fluidDensity;
        resolutionLog.fluidDensity = createProvenance("fluidDensity", element.fluidDensity, "kg/m3", "parsed", `element[${element.id || element.SEQ_NO}]`, matchedLine, format, "", "high");
    } else if (llAttrs && llAttrs.DensityDirect) {
        resolved.fluidDensity = parseFloat(llAttrs.DensityDirect);
        resolutionLog.fluidDensity = createProvenance("fluidDensity", resolved.fluidDensity, "kg/m3", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "parsed fluidDensity missing", "medium");
    } else if (llAttrs && llAttrs.DensityLiquid) { // basic fallback
        resolved.fluidDensity = parseFloat(llAttrs.DensityLiquid);
        resolutionLog.fluidDensity = createProvenance("fluidDensity", resolved.fluidDensity, "kg/m3", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "parsed fluidDensity missing, used Liquid", "medium");
    } else {
        resolved.fluidDensity = manualInputs.fluidDensity || 1000;
        resolutionLog.fluidDensity = createProvenance("fluidDensity", resolved.fluidDensity, "kg/m3", "manual", "user input", matchedLine, format, "no parsed/linelist density", "low");
    }

    if (element && element.T1) {
        resolved.T1 = element.T1;
        resolutionLog.T1 = createProvenance("T1", element.T1, "C", "parsed", `element[${element.id || element.SEQ_NO}]`, matchedLine, format, "", "high");
    } else if (globalOps.T1) {
        resolved.T1 = globalOps.T1;
        resolutionLog.T1 = createProvenance("T1", globalOps.T1, "C", "parsed", `global`, matchedLine, format, "element T1 missing", "medium");
    } else if (llAttrs && (llAttrs.DesignTemp || llAttrs.OperatingTemp)) {
        resolved.T1 = parseFloat(llAttrs.DesignTemp || llAttrs.OperatingTemp);
        resolutionLog.T1 = createProvenance("T1", resolved.T1, "C", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "parsed T1 missing", "medium");
    } else {
        resolved.T1 = manualInputs.T1 || 25;
        resolutionLog.T1 = createProvenance("T1", resolved.T1, "C", "manual", "user input", matchedLine, format, "no parsed/linelist T1", "low");
    }

    if (element && element.P1) {
        resolved.P1 = element.P1;
        resolutionLog.P1 = createProvenance("P1", element.P1, "MPa", "parsed", `element[${element.id || element.SEQ_NO}]`, matchedLine, format, "", "high");
    } else if (globalOps.P1) {
        resolved.P1 = globalOps.P1;
        resolutionLog.P1 = createProvenance("P1", globalOps.P1, "MPa", "parsed", `global`, matchedLine, format, "element P1 missing", "medium");
    } else if (llAttrs && (llAttrs.DesignPressure || llAttrs.OperatingPressure)) {
        resolved.P1 = parseFloat(llAttrs.DesignPressure || llAttrs.OperatingPressure);
        resolutionLog.P1 = createProvenance("P1", resolved.P1, "MPa", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "parsed P1 missing", "medium");
    } else {
        resolved.P1 = manualInputs.P1 || 0;
        resolutionLog.P1 = createProvenance("P1", resolved.P1, "MPa", "manual", "user input", matchedLine, format, "no parsed/linelist P1", "low");
    }

    // Flow Fields (velocity, slugLength)
    // Linelist > Manual
    if (llAttrs && llAttrs.Velocity) {
        resolved.velocity = parseFloat(llAttrs.Velocity);
        resolutionLog.velocity = createProvenance("velocity", resolved.velocity, "m/s", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "", "high");
    } else if (llAttrs && (llAttrs.VelocityLiquid || llAttrs.VelocityMixed)) {
        resolved.velocity = parseFloat(llAttrs.VelocityLiquid || llAttrs.VelocityMixed);
        resolutionLog.velocity = createProvenance("velocity", resolved.velocity, "m/s", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "used liquid/mixed vel fallback", "medium");
    } else {
        resolved.velocity = manualInputs.velocity || 0;
        resolutionLog.velocity = createProvenance("velocity", resolved.velocity, "m/s", "manual", "user input", matchedLine, format, "linelist velocity missing", "low");
        if (!manualInputs.velocity) assumptions.push("velocity missing, defaulted to 0");
    }

    if (llAttrs && llAttrs.SlugLength) {
        resolved.slugLength = parseFloat(llAttrs.SlugLength);
        resolutionLog.slugLength = createProvenance("slugLength", resolved.slugLength, "m", "linelist", `linelist[${matchedLine}]`, matchedLine, format, "", "high");
    } else {
        resolved.slugLength = manualInputs.slugLength;
        resolutionLog.slugLength = createProvenance("slugLength", manualInputs.slugLength, "m", "manual", "user input", matchedLine, format, "linelist slugLength missing", "medium");
    }

    // Assumptions (DAF, Phase)
    resolved.daf = manualInputs.daf || 2.0;
    resolutionLog.daf = createProvenance("daf", resolved.daf, "", "manual", "user input", matchedLine, format, "", "high");
    if (!manualInputs.daf) assumptions.push("DAF defaulted to 2.0");

    resolved.phase = llAttrs?.Phase || manualInputs.phase || "Mixed";
    resolutionLog.phase = createProvenance("phase", resolved.phase, "", llAttrs?.Phase ? "linelist" : "manual", llAttrs?.Phase ? `linelist[${matchedLine}]` : "user input", matchedLine, format, "", "high");

    return {
        basis: {
            lineRef,
            parsedFormat: format,
            elementIndex: element ? element.id || element.SEQ_NO : null,
            bendNode: bend ? bend.node : null,
            nodeId
        },
        resolved,
        resolutionLog,
        assumptions
    };
}
