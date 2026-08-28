import { useState } from "react";
import { FilterProvider, useFilters, type Filters } from "./context/FilterContext";
import IndiaMapView from "./components/IndiaMapView";
import LeadTimeElasticity from "./components/LeadTimeElasticity";
import RawListView from "./components/RawListView";
import SectorHeatmap from "./components/SectorHeatmap";
import TrendView from "./components/TrendView";
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
  { label: "AKASA", tone: "white" },
  { label: "mmt", tone: "red" },
  { label: "ixigo", tone: "orange" },
  { label: "DGCA", tone: "blue" },
];

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
            className={id === "trend" ? "dashboard-card dashboard-card--featured" : "dashboard-card"}
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

function AnalyticsView({ tab }: { tab: Tab }) {
  if (tab === "trend") return <TrendView />;
  if (tab === "heatmap") return <SectorHeatmap />;
  if (tab === "elasticity") return <LeadTimeElasticity />;
  return <RawListView />;
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
      <button type="button" className="analytics-home" onClick={onHome} aria-label="Back to SkyMetrics landing">
        <img src="/design-assets/skymetrics-logo.png" alt="" />
        <span>SkyMetrics</span>
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

function SidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        className={open ? "drawer-backdrop drawer-backdrop--open" : "drawer-backdrop"}
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className={open ? "sidebar-drawer sidebar-drawer--open" : "sidebar-drawer"} aria-hidden={!open}>
        <div className="sidebar-drawer__header">
          <h2>MENU</h2>
          <button type="button" aria-label="Close menu" onClick={onClose}>
            X
          </button>
        </div>
        <nav aria-label="Landing menu">
          {["LOGIN", "REGISTER", "DASHBOARD", "ANALYTICS", "SETTINGS", "SUPPORT"].map((item) => (
            <button key={item} type="button">
              {item}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

function LandingScreen({ onOpenAnalytics }: { onOpenAnalytics: (tab: Tab) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-landing">
      <SidebarDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main>
        <section id="landing" className="hero">
          <img className="landing-logo-chip" src="/design-assets/skymetrics-logo.png" alt="SkyMetrics" />
          <div className="hero-map-shell">
            <IndiaMapView />
          </div>

          <a href="#dashboard-reveal" className="scroll-cue" aria-label="Reveal dashboard">
            <span />
          </a>
        </section>

        <section className="landing-brand-panel" aria-label="SkyMetrics brand">
          <img src="/design-assets/skymetrics-logo.png" alt="" />
          <h1>SKYMETRICS</h1>
          <p>When Airfare Changes, Data Should Know</p>
        </section>

        <section id="dashboard-reveal" className="dashboard-reveal">
          <div className="panorama-wrap">
            <img
              src="/design-assets/desktop-5.png"
              alt=""
              className="panorama-image"
              draggable={false}
            />

            <div className="dashboard-nav-block">
              <button
                type="button"
                className="landing-menu-button"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <span />
                <span />
                <span />
              </button>
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
            <img className="landing-footer__mark" src="/design-assets/skymetrics-logo.png" alt="" />
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
