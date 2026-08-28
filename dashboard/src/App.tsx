import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";
import RawListView from "./components/RawListView";
import MapView from "./components/MapView";
import Landing from "./components/Landing";
import Navbar from "./components/Navbar";
import AskApixWidget from "./components/AskApixWidget";

type Tab = "map" | "trend" | "heatmap" | "elasticity" | "list";
type View = "landing" | "dashboard";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "map", label: "Route Map", icon: "map" },
  { id: "trend", label: "Trend Analysis", icon: "show_chart" },
  { id: "heatmap", label: "Sector Heatmap", icon: "grid_view" },
  { id: "elasticity", label: "Elasticity", icon: "analytics" },
  { id: "list", label: "Data Drill-down", icon: "database" },
];

function isTab(id: string): id is Tab {
  return TABS.some((section) => section.id === id);
}

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [tab, setTab] = useState<Tab>("map");
  const activeLabel = TABS.find((item) => item.id === tab)?.label ?? "";

  function goToSection(id: string) {
    if (isTab(id)) setTab(id);
    setView("dashboard");
  }

  return (
    <FilterProvider>
      <div className="min-h-screen bg-page text-primary">
        {view === "landing" && (
          <>
            <Navbar sections={TABS} onGoHome={() => setView("landing")} onGoToSection={goToSection} transparent />
            <Landing onEnterDashboard={() => setView("dashboard")} />
          </>
        )}

        {view === "dashboard" && (
          <div className="flex min-h-screen">
            <aside
              aria-label="Primary navigation"
              className="group fixed left-0 top-0 z-40 flex h-screen w-14 flex-col overflow-hidden border-r border-outline-variant bg-surface-container transition-[width] duration-200 hover:w-60 focus-within:w-60"
            >
              <button
                type="button"
                onClick={() => setView("landing")}
                aria-label="Back to SkyMetrics home"
                className="flex h-12 shrink-0 items-center gap-3 border-b border-outline-variant px-4 text-left"
              >
                <span className="shrink-0 font-mono text-lg font-bold text-accent">S</span>
                <span className="whitespace-nowrap text-sm font-bold tracking-tight text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  SkyMetrics
                </span>
              </button>
              <nav role="tablist" className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
                {TABS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={
                      tab === id
                        ? "flex items-center gap-3 border-l-2 border-accent bg-surface-container-high px-4 py-2 text-accent"
                        : "flex items-center gap-3 border-l-2 border-transparent px-4 py-2 text-secondary hover:bg-surface-container-highest hover:text-primary"
                    }
                  >
                    <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[20px]">
                      {icon}
                    </span>
                    <span className="whitespace-nowrap text-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {label}
                    </span>
                  </button>
                ))}
              </nav>
            </aside>

            <div className="ml-14 flex min-h-screen min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-outline-variant bg-surface-container px-4">
                <h1 className="font-mono text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  {activeLabel}
                </h1>
              </header>

              <div className="flex min-w-0 flex-1 gap-4 p-4">
                <div className="w-72 shrink-0 rounded-sm border border-outline-variant bg-panel p-4">
                  <Sidebar />
                  <div className="mt-6 border-t border-outline-variant pt-6">
                    <DataQualityPanel />
                  </div>
                </div>
                <main className="min-w-0 flex-1">
                  <div role="tabpanel">
                    {tab === "map" && <MapView />}
                    {tab === "trend" && <TrendView />}
                    {tab === "heatmap" && <SectorHeatmap />}
                    {tab === "elasticity" && <LeadTimeElasticity />}
                    {tab === "list" && <RawListView />}
                  </div>
                </main>
              </div>
            </div>
          </div>
        )}

        <AskApixWidget />
      </div>
    </FilterProvider>
  );
}
