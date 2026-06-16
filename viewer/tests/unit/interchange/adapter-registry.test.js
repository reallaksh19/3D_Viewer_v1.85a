import { pickImportAdapter } from '../../../interchange/source/adapter-registry.js';
import { CaesarXmlImportAdapter } from '../../../interchange/source/xml/CaesarXmlImportAdapter.js';
import { NeutralXmlImportAdapter } from '../../../interchange/source/xml/NeutralXmlImportAdapter.js';
import { RevImportAdapter } from '../../../interchange/source/rev/RevImportAdapter.js';
import { PcfImportAdapter } from '../../../interchange/source/pcf/PcfImportAdapter.js';
import { GenericJsonImportAdapter } from '../../../interchange/source/json/GenericJsonImportAdapter.js';

function runTests() {
  let passed = true;

  const mockXmlText = '<PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="1" DELTA_Y="0" DELTA_Z="0"></PIPINGELEMENT></PIPINGMODEL>';
  const matchXml = pickImportAdapter({ name: 'test.xml', text: mockXmlText });
  if (matchXml.Adapter !== CaesarXmlImportAdapter) {
    console.error('Test 1 Failed: Expected CaesarXmlImportAdapter');
    passed = false;
  }

  const neutralXmlText = '<Model><Components></Components></Model>';
  const matchNeutral = pickImportAdapter({ name: 'test.xml', text: neutralXmlText });
  if (matchNeutral.Adapter !== NeutralXmlImportAdapter) {
    console.error('Test 2 Failed: Expected NeutralXmlImportAdapter');
    passed = false;
  }

  const revText = 'HEAD\ninfo\nnote\ndate\nuser\nMODL\nProject\nPRIM\n2\n1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0\n100 10 10\nEND:\n';
  const matchRev = pickImportAdapter({ name: 'demo.rev', text: revText });
  if (matchRev.Adapter !== RevImportAdapter) {
    console.error('Test 3 Failed: Expected RevImportAdapter');
    passed = false;
  }

  const pcfText = 'PIPE\n    END-POINT 0 0 0 100\n    END-POINT 100 0 0 100\n';
  const matchPcf = pickImportAdapter({ name: 'demo.pcf', text: pcfText });
  if (matchPcf.Adapter !== PcfImportAdapter) {
    console.error('Test 4 Failed: Expected PcfImportAdapter');
    passed = false;
  }

  const jsonText = '{"items":[{"ep1":{"x":0,"y":0,"z":0},"ep2":{"x":1,"y":0,"z":0},"type":"PIPE"}]}' ;
  const matchJson = pickImportAdapter({ name: 'demo.json', text: jsonText });
  if (matchJson.Adapter !== GenericJsonImportAdapter) {
    console.error('Test 5 Failed: Expected GenericJsonImportAdapter');
    passed = false;
  }

  let unknownRejected = false;
  try {
    pickImportAdapter({ name: 'notes.txt', text: 'just text' });
  } catch {
    unknownRejected = true;
  }
  if (!unknownRejected) {
    console.error('Test 6 Failed: unknown input should throw no-adapter error.');
    passed = false;
  }

  if (passed) {
    console.log('\u2705 Adapter registry tests passed.');
  } else {
    process.exit(1);
  }
}

runTests();
