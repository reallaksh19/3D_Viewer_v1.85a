global.localStorage = { getItem: () => null, setItem: () => {} };
global.crypto = { randomUUID: () => 'mock-uuid-1234' };
import('./diag.test.js');
