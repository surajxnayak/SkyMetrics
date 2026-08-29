import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";
import RawListView from "./components/RawListView";
import HomeView from "./components/HomeView";
import AskApixWidget from "./components/AskApixWidget";
import Login from "./components/Login";

type Tab = "map" | "trend" | "heatmap" | "elasticity" | "list";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "map", label: "Route Map", icon: "map" },
  { id: "trend", label: "Trend Analysis", icon: "show_chart" },
  { id: "heatmap", label: "Sector Heatmap", icon: "grid_view" },
  { id: "elasticity", label: "Elasticity", icon: "analytics" },
  { id: "list", label: "Data Drill-down", icon: "database" },
];

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const activeLabel = TABS.find((item) => item.id === tab)?.label ?? "";

  if (!authed) {
    return <Login onContinue={() => setAuthed(true)} />;
  }

  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-page text-primary">
        <aside
          aria-label="Primary navigation"
          className="group fixed left-0 top-0 z-40 flex h-screen w-14 flex-col overflow-hidden border-r border-outline-variant bg-surface-container transition-[width] duration-200 hover:w-60 focus-within:w-60"
        >
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-outline-variant px-4">
            <img src="/brand/skymetrics-logo.png" alt="" className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap text-sm font-bold tracking-tight text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              SkyMetrics
            </span>
          </div>
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

          <div role="tabpanel" className="min-w-0 flex-1">
            {tab === "map" ? (
              <HomeView />
            ) : (
              <div className="min-w-0 flex-1">
                <Sidebar />
                <main className="min-w-0 p-4">
                  {tab === "trend" && <TrendView />}
                  {tab === "heatmap" && <SectorHeatmap />}
                  {tab === "elasticity" && <LeadTimeElasticity />}
                  {tab === "list" && <RawListView />}
                </main>
              </div>
            )}
          </div>
        </div>

        <AskApixWidget />
        <DataQualityWidget />
      </div>
    </FilterProvider>
  );
}

function DataQualityWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-20 z-50 flex flex-col items-start gap-3">
      {open && (
        <div role="dialog" aria-label="Data quality" className="max-h-[70vh] w-[min(24rem,calc(100vw-6rem))] overflow-y-auto rounded-sm border border-outline-variant bg-panel p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-primary">Data quality</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close data quality" className="text-secondary hover:text-primary">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <DataQualityPanel />
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close data quality" : "Open data quality"} title="Data quality" className="flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-warning shadow-lg hover:border-warning">
        <span aria-hidden="true" className="material-symbols-outlined text-[25px]">priority_high</span>
      </button>
    </div>
  );
}
