export function cegLossContractToUxmlLosses(lossContract = {}) {
  if (Array.isArray(lossContract)) return lossContract;
  const groups = [
    ['unsupportedEntities', 'UNSUPPORTED_ENTITY'],
    ['downgradedEntities', 'DOWNGRADED_ENTITY'],
    ['proxyEntities', 'PROXY_ENTITY'],
    ['exportWarnings', 'EXPORT_WARNING'],
  ];
  const losses = [];
  for (const [field, code] of groups) {
    for (const item of lossContract[field] || []) losses.push(toLoss(field, code, item));
  }
  return losses;
}

function toLoss(field, code, item = {}) {
  return {
    id: item.id ? `loss:${item.id}` : `loss:${code}:${stableKey(item)}`,
    severity: code === 'EXPORT_WARNING' ? 'WARNING' : 'INFO',
    code,
    componentId: item.componentId || '',
    sourceId: item.sourceId || '',
    message: item.message || code,
    details: { sourceField: field, original: item },
  };
}

function stableKey(value) {
  return JSON.stringify(value).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
}
