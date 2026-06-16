import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-route-report-uxml.test.js ---');

  const {
    buildInputXmlRouteReport,
    formatInputXmlRouteReportLines,
  } = await import('../xml-compare/InputXmlRouteReport.js');

  const report = buildInputXmlRouteReport({
    ok: true,
    route: 'UXML_ROUND_TRIP',
    fileName: 'uxml.xml',
    components: [
      { id: 'P1', type: 'PIPE' },
    ],
    uxmlRoundTrip: {
      uxml: {
        components: [
          {
            id: 'P1',
            anchors: [
              { role: 'EP1' },
              { role: 'EP2' },
            ],
            ports: [
              { role: 'END_1' },
              { role: 'END_2' },
            ],
          },
        ],
        pipelines: [{ id: 'LINE-1' }],
      },
      validation: { pass: true },
      universalGraph: {
        stats: {
          nodeCount: 2,
          edgeCount: 1,
          disconnectedCount: 0,
        },
      },
      rayGraph: {
        stats: {
          nodeCount: 2,
          edgeCount: 1,
          rayCandidateCount: 3,
          rayConnectionCount: 2,
        },
      },
      comparison: {
        stats: {
          promotionCandidateCount: 1,
        },
      },
      topologyDecision: {
        exportAllowed: true,
        outputBridgeReady: true,
        stats: {
          manualReviewCount: 0,
        },
      },
    },
    diagnostics: [
      { severity: 'WARNING', code: 'UXML-WARN', message: 'warn' },
      { severity: 'ERROR', code: 'UXML-ERR', message: 'err' },
    ],
  });

  assert.equal(report.schema, 'inputxml-route-report/v1');
  assert.equal(report.route, 'UXML_ROUND_TRIP');
  assert.equal(report.routeLabel, 'UXML Round Trip');
  assert.equal(report.mode, 'uxml-round-trip');
  assert.equal(report.componentCount, 1);
  assert.equal(report.uxml.componentCount, 1);
  assert.equal(report.uxml.anchorCount, 2);
  assert.equal(report.uxml.portCount, 2);
  assert.equal(report.uxml.pipelineCount, 1);
  assert.equal(report.topology.universalNodeCount, 2);
  assert.equal(report.topology.rayCandidateCount, 3);
  assert.equal(report.topology.rayConnectionCount, 2);
  assert.equal(report.topology.promotionCandidateCount, 1);
  assert.equal(report.topology.manualReviewCount, 0);
  assert.equal(report.topology.exportAllowed, true);
  assert.equal(report.topology.outputBridgeReady, true);
  assert.equal(report.diagnosticsSummary.warning, 1);
  assert.equal(report.diagnosticsSummary.error, 1);

  const lines = formatInputXmlRouteReportLines(report);
  assert.ok(lines.some((line) => line.includes('Route: UXML Round Trip')));
  assert.ok(lines.some((line) => line.includes('Universal Nodes: 2')));
  assert.ok(lines.some((line) => line.includes('Ray Candidates: 3')));

  console.log('[PASS] InputXML route report UXML passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML route report UXML failed.');
  console.error(error);
  process.exit(1);
});
