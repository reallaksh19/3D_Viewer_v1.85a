import fs from 'node:fs';
import { RvmFinal2dCsvBuilder } from '../viewer/rvm-pcf-extract/RvmFinal2dCsvBuilder.js';
import { RvmExtractHardening } from '../viewer/rvm-pcf-extract/RvmExtractHardening.js';
import { RvmPcfEmitter } from '../viewer/rvm-pcf-extract/RvmPcfEmitter.js';

const data = JSON.parse(fs.readFileSync('comments-1/ATTRIBUTE_managed_stage (1).json','utf8'));
function flatten(jsonData){
  const nodes=[]; let id=1;
  function getAttrs(el){ return el?.attributes && typeof el.attributes==='object' ? el.attributes : {}; }
  function normType(el){ return String(el?.type || el?.kind || getAttrs(el).TYPE || '').toUpperCase(); }
  function walk(el,parentPath=''){
    const name=String(el.name||el.id||`Node-${id}`).trim()||`Node-${id}`;
    const currentPath=parentPath ? `${parentPath}/${name}` : name;
    const node={id:`NODE-${id++}`, sourceObjectId:currentPath, canonicalObjectId:currentPath, renderObjectIds:[], name, kind:normType(el), parentCanonicalObjectId:parentPath||null, attributes:{}};
    for(const [k,v] of Object.entries(getAttrs(el))){
      if(v==null) continue;
      node.attributes[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    if(!node.attributes.TYPE && node.kind) node.attributes.TYPE=node.kind;
    nodes.push(node);
    for(const child of el.children||[]) walk(child,currentPath);
  }
  for(const root of data) walk(root,'');
  return {bundleId:'audit', nodes};
}
const index=flatten(data);
const builder=new RvmFinal2dCsvBuilder(index, {});
const {rows}=builder.build();
const hard=new RvmExtractHardening(); hard.sortRows(rows);
const emitter=new RvmPcfEmitter({allowPartialPcf:true});
const emitted=emitter.emit(rows);
const audit=hard.buildPcfAuditReport(rows, emitted.pcfTextByPipelineRef, 'comments-1 ATTRIBUTE');
const summary={
 nodes:index.nodes.length,
 rows:rows.length,
 included:rows.filter(r=>r.include!==false).length,
 convertedBore:rows.filter(r=>r.convertedBore!=null).length,
 lineKeyCandidates:rows.filter(r=>r.lineKeyBoreCandidate!=null).length,
 lineKeyFallback:rows.filter(r=>r.convertedBoreSource==='LINE-KEY').length,
 ep1Missing:rows.filter(r=>r.include!==false && !r.ep1).length,
 ep2Missing:rows.filter(r=>r.include!==false && !r.ep2).length,
 cpMissing:rows.filter(r=>r.include!==false && ['BEND','TEE'].includes(r.type) && !r.cp).length,
 pipelineCount:Object.keys(emitted.pcfTextByPipelineRef).length,
 emitErrors:emitted.errors.length,
 emitWarnings:emitted.warnings.length,
 auditPass:audit.pass,
 auditErrors:audit.bySeverity.ERROR||0,
 auditWarnings:audit.bySeverity.WARNING||0,
 generatedOrigin:audit.summary.generatedOriginCoordinateLines,
 pipeSkeyGenerated:audit.summary.generatedPipeBlocksWithSkey,
 sourceCa21Rows:audit.summary.rowsWithCa21,
 attr21Lines:audit.summary.generatedAttribute21Lines,
 downloadFiles: hard.downloadAllPcf(emitted.pcfTextByPipelineRef),
};
console.log(JSON.stringify(summary,null,2));
console.log('sample warnings', emitted.warnings.slice(0,5));
fs.writeFileSync('tmp/comments1_current_audit_summary.json', JSON.stringify({summary,audit}, null, 2));
