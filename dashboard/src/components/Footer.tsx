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

        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => event.preventDefault()}
          aria-label="Newsletter signup (not yet connected)"
        >
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
            Stay updated
          </h3>
          <div className="flex gap-2">
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <input
              id="footer-email"
              type="email"
              placeholder="Enter email"
              disabled
              className="rounded-sm border border-outline-variant bg-inset px-3 py-1.5 text-sm text-primary outline-none placeholder:text-muted disabled:opacity-60"
            />
            <button
              type="submit"
              disabled
              className="shrink-0 rounded-sm border border-outline-variant bg-surface-container-high px-3 py-1.5 text-sm text-secondary disabled:cursor-not-allowed"
            >
              Notify me
            </button>
          </div>
          <p className="text-xs text-muted">Coming soon -- not connected yet.</p>
        </form>
      </div>

      <p className="mx-auto mt-8 max-w-5xl border-t border-outline-variant pt-4 text-xs text-muted">
        SkyMetrics -- real-time airfare intelligence for India.
      </p>
    </footer>
  );
}
