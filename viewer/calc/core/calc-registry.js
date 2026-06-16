const registry = new Map();

export function registerCalculator(id, calcModule) {
  registry.set(id, calcModule);
}

export function getCalculator(id) {
  return registry.get(id);
}

export function getAllCalculators() {
  return Array.from(registry.values());
}
