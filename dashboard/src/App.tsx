import { useEffect, useMemo, useState } from "react";
import { FilterProvider, useFilters, type Filters } from "./context/FilterContext";
import IndiaMapView from "./components/IndiaMapView";
import {
  CARRIERS,
  ROUTES,
  SOURCES,
  TIME_PRESETS,
  datesForTimePreset,
} from "./config/filters";

type Tab = "trend" | "heatmap" | "elasticity" | "list";
type Screen = "landing" | "analytics";

const TABS: { id: Tab; label: string; eyebrow: string; title: string }[] = [
  { id: "elasticity", label: "Elasticity", eyebrow: "Sensitivity", title: "ELASTICITY" },
  { id: "trend", label: "Trends", eyebrow: "Index", title: "TRENDS" },
  { id: "heatmap", label: "Heatmap", eyebrow: "Sectors", title: "HEATMAP" },
  { id: "list", label: "List", eyebrow: "Records", title: "LIST" },
];

const SOURCE_TILES = [
  { label: "Akasa Air", tone: "white" },
  { label: "mmt", tone: "red" },
  { label: "ixigo", tone: "orange" },
  { label: "DGCA", tone: "blue" },
];

const HEATMAP_ROWS = [
  ["BOM-BLR", "2026-08-24", "58", "7545", "4120", "12980", "+8.2%", "High", "On Time"],
  ["DEL-BLR", "2026-08-24", "63", "7833", "4380", "13450", "-3.6%", "Very High", "On Time"],
  ["DEL-BOM", "2026-08-24", "54", "7259", "3980", "11990", "+5.4%", "High", "Delayed"],
  ["MAA-HYD", "2026-08-24", "49", "6622", "3590", "10990", "-1.8%", "Medium", "On Time"],
  ["CCU-DEL", "2026-08-24", "45", "6981", "3720", "11250", "+2.7%", "Medium", "On Time"],
  ["BLR-CCU", "2026-08-24", "52", "6408", "3450", "9980", "+4.1%", "Medium", "On Time"],
  ["HYD-BOM", "2026-08-24", "47", "7125", "3850", "11680", "-2.3%", "High", "On Time"],
  ["AMD-DEL", "2026-08-24", "60", "6890", "3650", "10890", "+6.6%", "Very High", "On Time"],
];

const LIST_ROWS = [
  ["2026-08-24 07:14", "2026-08-25", "DEL-BOM", "akasaair", "QP", "T+1", "T3", "DEL-BOM", "available", "INR 6,880", "-INR 773"],
  ["2026-08-24 07:14", "2026-08-25", "DEL-BOM", "akasaair", "QP", "T+1", "U1", "DXN-BOM", "available", "INR 6,968", "-INR 685"],
  ["2026-08-24 07:14", "2026-08-25", "DEL-BOM", "akasaair", "QP", "T+1", "T3", "DEL-BOM", "available", "INR 7,281", "-INR 372"],
  ["2026-08-24 07:14", "2026-08-25", "DEL-BOM", "akasaair", "QP", "T+1", "U1", "DXN-BOM", "available", "INR 7,388", "-INR 265"],
  ["2026-08-24 07:14", "2026-08-31", "DEL-BOM", "akasaair", "QP", "T+7", "T0", "DEL-NMI", "available", "INR 6,804", "-INR 849"],
  ["2026-08-24 07:14", "2026-08-31", "DEL-BOM", "akasaair", "QP", "T+7", "Q2", "DEL-BOM", "available", "INR 8,321", "+INR 668"],
  ["2026-08-24 07:14", "2026-09-08", "DEL-BOM", "akasaair", "QP", "T+15", "T3", "DEL-BOM", "available", "INR 6,880", "-INR 773"],
];

function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function updateProgress() {
      const start = window.innerHeight * 0.16;
      const end = window.innerHeight * 1.28;
      const next = (window.scrollY - start) / (end - start);
      setProgress(Math.max(0, Math.min(1, next)));
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return progress;
}

function nextTab(current: Tab, direction: 1 | -1): Tab {
  const currentIndex = TABS.findIndex((item) => item.id === current);
  const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
  return TABS[nextIndex].id;
}

function scrollToTop() {
  try {
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

function DashboardCardCarousel({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const [offset, setOffset] = useState(0);
  const [spin, setSpin] = useState<"next" | "prev" | null>(null);
  const visibleTabs = [0, 1, 2].map((index) => TABS[(offset + index) % TABS.length]);

  function rotate(direction: "next" | "prev") {
    setSpin(direction);
    window.setTimeout(() => {
      setOffset((current) =>
        direction === "next"
          ? (current + 1) % TABS.length
          : (current - 1 + TABS.length) % TABS.length
      );
      setSpin(null);
    }, 220);
  }

  return (
    <div className="dashboard-card-row" role="tablist" aria-label="Dashboard views">
      <button
        className="dashboard-arrow"
        type="button"
        aria-label="Previous dashboard card"
        onClick={() => rotate("prev")}
      >
        &#8249;
      </button>
      <div className={spin ? `dashboard-card-track dashboard-card-track--${spin}` : "dashboard-card-track"}>
        {visibleTabs.map(({ id, label, eyebrow }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === "trend"}
            aria-label={label}
            onClick={() => onOpen(id)}
            className="dashboard-card"
          >
            <span>{eyebrow}</span>
            {label}
          </button>
        ))}
      </div>
      <button
        className="dashboard-arrow"
        type="button"
        aria-label="Next dashboard card"
        onClick={() => rotate("next")}
      >
        &#8250;
      </button>
    </div>
  );
}

function FilterDock() {
  const { filters, setFilters, applyFilters, hasPendingChanges } = useFilters();
  const [open, setOpen] = useState(false);

  function updateTimePreset(presetId: string) {
    setFilters((prev) => {
      const dates = datesForTimePreset(presetId);
      return {
        ...prev,
        timePreset: presetId,
        ...(dates ?? {}),
      };
    });
  }

  function toggleRoute(route: string) {
    setFilters((prev) => {
      const selected = prev.selectedRoutes.includes(route);
      if (selected && prev.selectedRoutes.length === 1) return prev;
      return {
        ...prev,
        selectedRoutes: selected
          ? prev.selectedRoutes.filter((item) => item !== route)
          : [...prev.selectedRoutes, route],
      };
    });
  }

  return (
    <div className={open ? "filter-dock filter-dock--open" : "filter-dock"}>
      {!open ? (
        <button type="button" className="filter-toggle" onClick={() => setOpen(true)}>
          FILTER
        </button>
      ) : (
        <div className="filter-bar" aria-label="Expanded filters">
          <label className="filter-chip filter-chip--active">
            <select
              aria-label="Frequency"
              value={filters.frequency}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  frequency: event.target.value as Filters["frequency"],
                }))
              }
            >
              <option value="daily">Frequency</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="filter-menu">
            <span>Time Range</span>
            <select
              aria-label="Time range"
              value={filters.timePreset}
              onChange={(event) => updateTimePreset(event.target.value)}
            >
              {TIME_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-menu filter-menu--routes">
            <span>Routes</span>
            <div>
              {ROUTES.map((route) => (
                <label key={route.id}>
                  <input
                    type="checkbox"
                    checked={filters.selectedRoutes.includes(route.id)}
                    onChange={() => toggleRoute(route.id)}
                  />
                  {route.id}
                </label>
              ))}
            </div>
          </div>
          <label className="filter-menu">
            <span>Source</span>
            <select
              aria-label="Source"
              value={filters.sources[0] ?? ""}
              onChange={(event) => setFilters((prev) => ({ ...prev, sources: [event.target.value] }))}
            >
              {SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-menu">
            <span>Carrier</span>
            <select
              aria-label="Carrier"
              value={filters.carrier}
              onChange={(event) => setFilters((prev) => ({ ...prev, carrier: event.target.value }))}
            >
              {CARRIERS.map((carrier) => (
                <option key={carrier.code} value={carrier.code}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-menu">
            <span>Fare Class</span>
            <input
              aria-label="Fare class"
              value={filters.fareClass}
              onChange={(event) => setFilters((prev) => ({ ...prev, fareClass: event.target.value.toUpperCase() }))}
            />
          </label>
          <button
            type="button"
            className={hasPendingChanges ? "filter-apply filter-apply--pending" : "filter-apply"}
            onClick={() => {
              applyFilters();
              setOpen(false);
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

function ViewSkeleton({ title }: { title: string }) {
  return (
    <div className="analytics-skeleton" role="status" aria-label={`Loading ${title}`}>
      <div className="skeleton-line skeleton-line--title" />
      <div className="skeleton-chart">
        <span />
        <span />
        <span />
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}

function ChartFrame({ variant }: { variant: "trend" | "elasticity" }) {
  const trendPath = "M70 226 L290 214 L514 206 L738 86 L960 86";
  const trendPathTwo = "M70 214 L290 202 L514 196 L738 78 L960 84";
  const trendPathThree = "M70 220 L290 218 L514 212 L738 92 L960 90";
  const elasticityPath = "M70 70 C210 112 276 156 388 154 C530 150 630 128 738 104 C842 78 902 88 960 98";
  const elasticityPathTwo = "M70 126 C224 128 332 136 450 132 C570 126 692 76 804 82 C884 84 930 90 960 94";
  const elasticityPathThree = "M70 176 C240 170 356 150 514 132 C674 114 812 116 960 132";

  return (
    <div className="mock-chart">
      <p>Routes: BOM-BLR, DEL-BLR, DEL-BOM</p>
      <svg viewBox="0 0 1040 280" role="img" aria-label={`${variant} chart skeleton`}>
        {[44, 92, 140, 188, 236].map((y) => (
          <line key={y} x1="52" x2="1000" y1={y} y2={y} className="mock-chart__grid" />
        ))}
        {[70, 290, 514, 738, 960].map((x) => (
          <line key={x} x1={x} x2={x} y1="38" y2="244" className="mock-chart__grid" />
        ))}
        <line x1="52" x2="1000" y1="244" y2="244" className="mock-chart__axis" />
        <line x1="52" x2="52" y1="38" y2="244" className="mock-chart__axis" />
        <path d={variant === "trend" ? trendPath : elasticityPath} className="mock-chart__line mock-chart__line--purple" />
        <path d={variant === "trend" ? trendPathTwo : elasticityPathTwo} className="mock-chart__line mock-chart__line--green" />
        <path d={variant === "trend" ? trendPathThree : elasticityPathThree} className="mock-chart__line mock-chart__line--gold" />
      </svg>
      <div className="mock-legend">
        <span>BOM-BLR</span>
        <span>DEL-BLR</span>
        <span>DEL-BOM</span>
      </div>
    </div>
  );
}

function TrendSkeletonView() {
  return (
    <div className="mock-view mock-view--trend">
      <h2>Trend View</h2>
      <ChartFrame variant="trend" />
      <div className="data-quality-card">
        <h3>Data Quality</h3>
        <p>Coverage: <strong>100%</strong></p>
        <p>Outliers flagged: <strong>2.8%</strong></p>
        <p>Source health: <strong>388 available / 0 no-flight</strong></p>
      </div>
    </div>
  );
}

function HeatmapSkeletonView() {
  return (
    <div className="mock-view">
      <div className="mock-table-wrap">
        <table className="mock-table">
          <thead>
            <tr>
              {["Route", "Date", "Flights", "Avg Price", "Min Price", "Max Price", "Change", "Demand", "Status"].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td
                    key={`${row[0]}-${index}`}
                    className={
                      index === 6
                        ? cell.startsWith("+")
                          ? "mock-table__up"
                          : "mock-table__down"
                        : index === 7
                          ? "mock-table__demand"
                          : index === 8
                            ? "mock-table__status"
                            : undefined
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ElasticitySkeletonView() {
  return (
    <div className="mock-view">
      <h2>Lead Time Elasticity</h2>
      <ChartFrame variant="elasticity" />
      <button type="button" className="mock-export">Export CSV</button>
    </div>
  );
}

function ListSkeletonView() {
  return (
    <div className="mock-view">
      <div className="list-view-heading">
        <h2>List Time</h2>
        <button type="button" className="mock-export">Export CSV</button>
      </div>
      <div className="mock-table-wrap">
        <table className="mock-table mock-table--dense">
          <thead>
            <tr>
              {["Collected", "Travel", "Route", "Source", "Carrier", "Window", "Class", "Routing", "Status", "Price", "Vs mean"].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIST_ROWS.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, index) => (
                  <td key={`${rowIndex}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsView({ tab }: { tab: Tab }) {
  if (tab === "trend") return <TrendSkeletonView />;
  if (tab === "heatmap") return <HeatmapSkeletonView />;
  if (tab === "elasticity") return <ElasticitySkeletonView />;
  return <ListSkeletonView />;
}

function AnalyticsScreen({
  tab,
  onTabChange,
  onHome,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onHome: () => void;
}) {
  const [loadingView, setLoadingView] = useState(false);
  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[1];

  function rotateView(direction: 1 | -1) {
    setLoadingView(true);
    const selected = nextTab(tab, direction);
    window.setTimeout(() => {
      onTabChange(selected);
      window.setTimeout(() => setLoadingView(false), 280);
    }, 180);
  }

  return (
    <div className="analytics-screen">
      <FilterDock />
      <button type="button" className="analytics-home" onClick={onHome}>
        SkyMetrics
      </button>
      <button
        type="button"
        className="analytics-view-arrow analytics-view-arrow--left"
        aria-label="Previous analytical view"
        onClick={() => rotateView(-1)}
      >
        &#8249;
      </button>
      <button
        type="button"
        className="analytics-view-arrow analytics-view-arrow--right"
        aria-label="Next analytical view"
        onClick={() => rotateView(1)}
      >
        &#8250;
      </button>
      <main className="analytics-content">
        <h1>{activeTab.title}</h1>
        <div className="analytics-surface">
          {loadingView ? (
            <ViewSkeleton title={activeTab.label} />
          ) : (
            <AnalyticsView tab={tab} />
          )}
        </div>
      </main>
    </div>
  );
}

function LandingScreen({ onOpenAnalytics }: { onOpenAnalytics: (tab: Tab) => void }) {
  const revealProgress = useScrollProgress();
  const heroMapStyle = useMemo(
    () => ({
      transform: `perspective(1300px) rotateX(${18 - revealProgress * 11}deg) rotateZ(${
        -2.4 + revealProgress * 1.8
      }deg) scale(${0.88 + revealProgress * 0.05}) translateY(${revealProgress * 28}px)`,
    }),
    [revealProgress]
  );
  const panoramaStyle = useMemo(
    () => ({
      clipPath: `inset(${Math.max(0, 55 - revealProgress * 55)}% ${Math.max(
        0,
        7 - revealProgress * 7
      )}% 0)`,
      opacity: 0.22 + revealProgress * 0.78,
      transform: `translateY(${64 - revealProgress * 64}px) scale(${0.94 + revealProgress * 0.06})`,
    }),
    [revealProgress]
  );

  return (
    <div className="app-landing">
      <header className="topbar">
        <a href="#landing" className="brand-lockup" aria-label="SkyMetrics home">
          <span className="brand-mark" aria-hidden="true" />
          <span>SkyMetrics</span>
        </a>
        <nav className="topbar-links" aria-label="Primary">
          <a href="#dashboard-reveal">Dashboard</a>
          <a href="#landing-footer">About</a>
        </nav>
      </header>

      <main>
        <section id="landing" className="hero">
          <div className="hero-copy">
            <p className="hero-eyebrow">Real-time airfare intelligence</p>
            <h1>SkyMetrics</h1>
            <p>
              Fare-route CPI signals from live node selection, rendered as a national route network.
            </p>
          </div>

          <div className="hero-map-shell" style={heroMapStyle}>
            <IndiaMapView />
          </div>

          <a href="#dashboard-reveal" className="scroll-cue" aria-label="Reveal dashboard">
            <span />
          </a>
        </section>

        <section id="dashboard-reveal" className="dashboard-reveal">
          <div className="panorama-wrap">
            <img
              src="/design-assets/desktop-5.png"
              alt=""
              className="panorama-image"
              style={panoramaStyle}
              draggable={false}
            />

            <div className="dashboard-nav-block">
              <h2>Dashboard</h2>
              <DashboardCardCarousel onOpen={onOpenAnalytics} />

              <div className="source-strip" aria-label="Data sources">
                {SOURCE_TILES.map((source) => (
                  <div key={source.label} className={`source-tile source-tile--${source.tone}`}>
                    {source.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer id="landing-footer" className="landing-footer">
          <div className="landing-footer__brand">
            <span className="brand-mark landing-footer__mark" aria-hidden="true" />
            <div>
              <h2>SkyMetrics</h2>
              <p>Real-Time Airfare Intelligence | From Fare Data to Economic Insight</p>
            </div>
          </div>
          <div className="landing-footer__seal" aria-hidden="true">
            <span />
          </div>
          <p className="landing-footer__tagline">When Airfare Changes, Data Should Know</p>
        </footer>
      </main>
    </div>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [tab, setTab] = useState<Tab>("trend");

  function openAnalytics(next: Tab) {
    setTab(next);
    setScreen("analytics");
    scrollToTop();
  }

  if (screen === "analytics") {
    return (
      <AnalyticsScreen
        tab={tab}
        onTabChange={setTab}
        onHome={() => {
          setScreen("landing");
          window.setTimeout(scrollToTop, 0);
        }}
      />
    );
  }

  return <LandingScreen onOpenAnalytics={openAnalytics} />;
}

export default function App() {
  return (
    <FilterProvider>
      <AppContent />
    </FilterProvider>
  );
}
