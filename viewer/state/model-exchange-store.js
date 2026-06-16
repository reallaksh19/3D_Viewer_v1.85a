import { ViewStateController } from '../view/ViewStateController.js';

export function createModelExchangeStore() {
  const viewState = new ViewStateController();
  const store = {
    sourceRecord: null,
    parsed: null,
    project: null,
    sourcePreview: null,
    canonicalPreview: null,
    renderedPreview: null,
    viewState: viewState.state,
    listeners: new Set(),
  };

  store.subscribe = (fn) => { store.listeners.add(fn); return () => store.listeners.delete(fn); };
  store.notify = () => store.listeners.forEach((fn) => fn(store));
  store.patch = (patch) => { Object.assign(store, patch); store.notify(); };
  store.setViewState = (patch) => { store.viewState = viewState.update(patch); store.notify(); };
  return store;
}
