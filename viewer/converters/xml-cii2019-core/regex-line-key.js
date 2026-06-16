function _toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function tokenizeBranchName(branchName, delimiter = '-') {
  const cleaned = _toText(branchName).trim().replace(/^\/+/, '').replace(/\/B\d+$/i, '');
  const delim = _toText(delimiter) || '-';
  return cleaned.split(delim).map((token) => token.trim()).filter(Boolean);
}

export function tokenAtPosition(branchName, delimiter, oneBasedIndex) {
  const index = Number(oneBasedIndex);
  if (!Number.isFinite(index) || index <= 0) return '';
  return tokenizeBranchName(branchName, delimiter)[Math.round(index) - 1] || '';
}

export function xmlCiiTokenPositionList(value) {
  if (Array.isArray(value)) return value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0);
  const text = _toText(value).trim();
  if (!text) return [];
  if (!/^\s*\d+(?:\s*[,+]\s*\d+)*\s*$/.test(text)) return [];
  return text
    .split(/[,+]/)
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

export function xmlCiiLineKeyFromBranchTokens(branchName, config) {
  const linelist = config.linelist || {};
  const positions = xmlCiiTokenPositionList(linelist.lineKeyTokenPositions);
  const safePositions = positions.length ? positions : [4];
  const delimiter = linelist.tokenDelimiter || '-';
  const joiner = _toText(linelist.lineKeyJoiner);
  const parts = safePositions.map((position) => tokenAtPosition(branchName, delimiter, position)).filter(Boolean);
  return parts.join(joiner);
}

export function deriveLineKeyFromBranchName(branchName, config) {
  const text = _toText(branchName).trim();
  const linelist = config.linelist || {};
  const byToken = xmlCiiLineKeyFromBranchTokens(text, config);
  if (byToken) return byToken;
  const pattern = _toText(linelist.branchNameRegex).trim();
  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      const match = regex.exec(text);
      const group = Math.max(0, Number(linelist.lineNoGroup || 0));
      if (match && match[group]) return match[group];
    } catch {}
  }
  return '';
}
