import { useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import Sidebar from "./components/Sidebar";
import DataQualityPanel from "./components/DataQualityPanel";
import TrendView from "./components/TrendView";
import SectorHeatmap from "./components/SectorHeatmap";
import LeadTimeElasticity from "./components/LeadTimeElasticity";

type Tab = "trend" | "heatmap" | "elasticity";

export default function App() {
  const [tab, setTab] = useState<Tab>("trend");

  return (
    <FilterProvider>
      <div style={{ display: "flex" }}>
        <div>
          <h1>SkyMetrics APIx Dashboard</h1>
          <Sidebar />
          <DataQualityPanel />
        </div>
        <main>
          <div role="tablist">
            <button role="tab" aria-selected={tab === "trend"} onClick={() => setTab("trend")}>
              Trend
            </button>
            <button role="tab" aria-selected={tab === "heatmap"} onClick={() => setTab("heatmap")}>
              Heatmap
            </button>
            <button role="tab" aria-selected={tab === "elasticity"} onClick={() => setTab("elasticity")}>
              Elasticity
            </button>
          </div>
          <div role="tabpanel">
            {tab === "trend" && <TrendView />}
            {tab === "heatmap" && <SectorHeatmap />}
            {tab === "elasticity" && <LeadTimeElasticity />}
          </div>
        </main>
      </div>
    </FilterProvider>
  );
}
