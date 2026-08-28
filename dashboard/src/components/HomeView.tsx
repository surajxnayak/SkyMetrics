import MapView from "./MapView";
import BrandStrip from "./BrandStrip";
import Footer from "./Footer";

export default function HomeView() {
  return (
    <div className="w-full">
      <div className="px-6 pb-6 pt-8 text-center">
        <h1 className="text-3xl font-bold text-primary sm:text-4xl">
          See India&apos;s airfares move in real time
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-on-surface-variant">
          Click a city to see its real route coverage and CPI -- every number here is read
          straight from the database, never invented.
        </p>
      </div>

      <MapView />

      <div className="mt-10">
        <BrandStrip />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden border-y border-outline-variant bg-outline-variant sm:grid-cols-4">
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

      <Footer />
    </div>
  );
}
