/**
 * Manages the current active session state for the bottom console.
 */
let currentSession = null;
const listeners = new Set();

export function setSession(envelope) {
  currentSession = envelope;
  notifyListeners();
}

export function getSession() {
  return currentSession;
}

export function clearSession() {
  currentSession = null;
  notifyListeners();
}

export function subscribeSession(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentSession);
  }
}

export const calcHistory = [];

export function appendToHistory(envelope) {
    calcHistory.push({ ts: new Date(), ...envelope });
}
