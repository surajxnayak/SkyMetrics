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
          <nav>
            <button onClick={() => setTab("trend")} aria-pressed={tab === "trend"}>
              Trend
            </button>
            <button onClick={() => setTab("heatmap")} aria-pressed={tab === "heatmap"}>
              Heatmap
            </button>
            <button onClick={() => setTab("elasticity")} aria-pressed={tab === "elasticity"}>
              Elasticity
            </button>
          </nav>
          {tab === "trend" && <TrendView />}
          {tab === "heatmap" && <SectorHeatmap />}
          {tab === "elasticity" && <LeadTimeElasticity />}
        </main>
      </div>
    </FilterProvider>
  );
}
