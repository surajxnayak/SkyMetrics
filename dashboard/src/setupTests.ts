import "@testing-library/jest-dom";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
// ponytail: minimal no-op stub, upgrade if a test needs real resize callbacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

// jsdom has no layout engine, so getBoundingClientRect always returns 0x0,
// and recharts refuses to render chart content into a 0x0 container.
// ponytail: fixed 500x300 is arbitrary-but-sufficient to make recharts render
// real SVG content in tests; it doesn't simulate any specific real layout.
Element.prototype.getBoundingClientRect = () => ({
  width: 500,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 500,
  x: 0,
  y: 0,
  toJSON: () => {},
});
