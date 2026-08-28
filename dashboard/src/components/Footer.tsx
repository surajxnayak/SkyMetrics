export default function Footer() {
  return (
    <footer className="border-t border-outline-variant bg-surface-container-low px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <img src="/brand/skymetrics-logo.png" alt="" className="h-6 w-6" />
            <span className="font-mono text-sm font-bold tracking-[0.15em] text-primary">SKYMETRICS</span>
          </div>
          <p className="max-w-xs text-sm text-secondary">
            Real-time airfare intelligence -- from fare data to economic insight.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
            Resources
          </h3>
          <a href="https://github.com" className="text-sm text-secondary hover:text-primary">
            Methodology
          </a>
          <a href="https://github.com" className="text-sm text-secondary hover:text-primary">
            Data sources
          </a>
          <a href="https://github.com" className="text-sm text-secondary hover:text-primary">
            API docs
          </a>
        </div>

      </div>

      <p className="mx-auto mt-8 max-w-5xl border-t border-outline-variant pt-4 text-xs text-muted">
        SkyMetrics -- real-time airfare intelligence for India.
      </p>
    </footer>
  );
}
