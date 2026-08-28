import HeroMap from "./HeroMap";
import BrandStrip from "./BrandStrip";
import Footer from "./Footer";

interface LandingProps {
  onEnterDashboard: () => void;
}

export default function Landing({ onEnterDashboard }: LandingProps) {
  return (
    <div>
      <section className="relative h-[62vh] min-h-[420px] overflow-hidden bg-page">
        <HeroMap />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{ background: "linear-gradient(to bottom, transparent, var(--color-page))" }}
        />
      </section>

      <section className="relative z-10 -mt-1 flex flex-col items-center gap-4 bg-page px-6 pb-16 pt-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          SIH26056 &middot; MoSPI / DIID
        </p>
        <h1 className="max-w-3xl text-4xl font-bold text-primary sm:text-5xl">
          See India&apos;s airfares move in real time
        </h1>
        <p className="max-w-xl text-base text-on-surface-variant">
          SkyMetrics turns live fare data into a published price index -- real routes, real
          formulas, real government-backed validation.
        </p>
        <button
          type="button"
          onClick={onEnterDashboard}
          className="mt-2 rounded-sm bg-accent px-6 py-2.5 text-sm font-semibold text-page hover:bg-accent-hover"
        >
          Explore the dashboard
        </button>
      </section>

      <section className="flex flex-col items-center gap-6 bg-page px-6 py-20">
        <img src="/brand/skymetrics-logo.png" alt="SkyMetrics" className="h-16 w-16" />
        <h2 className="text-3xl font-light tracking-[0.35em] text-primary sm:text-4xl">SKYMETRICS</h2>

        <div className="mt-6 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-sm border border-outline-variant bg-outline-variant sm:grid-cols-4">
          {[
            { n: "4", l: "Index formulas" },
            { n: "161", l: "Airports mapped" },
            { n: "5", l: "Booking windows" },
            { n: "200+", l: "Automated tests" },
          ].map((stat) => (
            <div key={stat.l} className="bg-surface-container-low p-4 text-center">
              <p className="font-mono text-2xl font-bold text-accent">{stat.n}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-on-surface-variant">{stat.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 w-full">
          <BrandStrip />
        </div>
      </section>

      <Footer />
    </div>
  );
}
