import "@testing-library/jest-dom";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
// ponytail: minimal no-op stub, upgrade if a test needs real resize callbacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
