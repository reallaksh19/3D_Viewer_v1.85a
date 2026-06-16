export function generateBenchmarkReport(results) {
  let html = `
    <div class="benchmark-report">
      <h3>Benchmark Summary</h3>
      <p>Total Cases: ${results.total}</p>
      <p style="color: green">Passed: ${results.passed}</p>
      <p style="color: red">Failed: ${results.failed}</p>
      <p style="color: darkred">Errors: ${results.errors}</p>
  `;

  if (results.mismatches.length > 0) {
    html += `<h4>Mismatches</h4><ul>`;
    for (const m of results.mismatches) {
      html += `<li><strong>Case ${m.caseId}:</strong> ${m.reason || m.reasons?.join(', ')}</li>`;
    }
    html += `</ul>`;
  }

  html += `</div>`;
  return html;
}
