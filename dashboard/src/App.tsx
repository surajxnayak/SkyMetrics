import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";
import RawListView from "./components/RawListView";
import IndiaMapView from "./components/IndiaMapView";

type Tab = "map" | "trend" | "heatmap" | "elasticity" | "list";

const TABS: { id: Tab; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "trend", label: "Trend" },
  { id: "heatmap", label: "Heatmap" },
  { id: "elasticity", label: "Elasticity" },
  { id: "list", label: "List" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("map");

  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-page text-primary">
        <div className="w-72 shrink-0 border-r border-line bg-panel p-6">
          <h1 className="mb-6 text-lg font-semibold tracking-tight">SkyMetrics APIx Dashboard</h1>
          <Sidebar />
          <div className="mt-6 border-t border-line pt-6">
            <DataQualityPanel />
          </div>
        </div>
        <main className="flex-1 p-8">
          <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "border-b-2 border-accent px-4 py-2 text-sm font-medium text-primary"
                    : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary hover:text-primary"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "map" && <IndiaMapView />}
            {tab === "trend" && <TrendView />}
            {tab === "heatmap" && <SectorHeatmap />}
            {tab === "elasticity" && <LeadTimeElasticity />}
            {tab === "list" && <RawListView />}
          </div>
        </main>
      </div>
    </FilterProvider>
  );
}
