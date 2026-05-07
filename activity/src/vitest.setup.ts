// Node.js v22+ ships a built-in localStorage (node:internal/webstorage) that
// requires --localstorage-file to be functional. Vitest's jsdom environment
// sets up its own localStorage on dom.window but does not override the native
// Node.js global (it is filtered from populateGlobal because 'localStorage' is
// not in vitest's KEYS list). This shim forwards all localStorage calls to
// jsdom's window.localStorage so unit tests can use the Web Storage API
// without any Node.js filesystem flag.
const jsDomStorage = (globalThis as unknown as { jsdom?: { window: Window } }).jsdom?.window
  .localStorage;
if (jsDomStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsDomStorage,
    configurable: true,
    writable: true,
  });
}
