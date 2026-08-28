import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import DataQualityPanel, { computeStats } from "../components/DataQualityPanel";

const RECORDS = vi.hoisted(() => [
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    source: "akasaair",
    advance_window: "T+1",
    fare_class: "U1",
    total_fare: 7000,
    status: "available",
    is_outlier: false,
    collected_at: "2026-08-24T10:00:00+00:00",
  },
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    source: "akasaair",
    advance_window: "T+1",
    fare_class: "U1",
    total_fare: 999999,
    status: "available",
    is_outlier: true,
    collected_at: "2026-08-24T11:00:00+00:00",
  },
  {
    origin: "DEL",
    destination: "BLR",
    carrier: "QP",
    source: "akasaair",
    advance_window: "T+7",
    fare_class: "U1",
    total_fare: null,
    status: "no_flight",
    is_outlier: false,
    collected_at: "2026-08-24T12:00:00+00:00",
  },
]);

describe("computeStats", () => {
  it("computes coverage against the expected route x window combinations", () => {
    const stats = computeStats(RECORDS, ["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

    expect(stats.coveragePercent).toBeCloseTo((2 / 15) * 100, 5);
  });

  it("computes the outlier rate", () => {
    const stats = computeStats(RECORDS, ["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

    expect(stats.outlierPercent).toBeCloseTo((1 / 3) * 100, 5);
  });

  it("counts available vs no-flight records for source health", () => {
    const stats = computeStats(RECORDS, ["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

    expect(stats.availableCount).toBe(2);
    expect(stats.noFlightCount).toBe(1);
  });
});

vi.mock("../api/client", () => ({
  getFares: vi.fn().mockResolvedValue(RECORDS),
  getMetadata: vi.fn().mockResolvedValue({
    weights: {
      source: "test",
      period: "2025",
      computed_at: "2026-08-24",
      weights: { "DEL-BOM": 0.5, "DEL-BLR": 0.3, "BOM-BLR": 0.2 },
    },
    formulas: {},
    snapshots: [],
  }),
}));

describe("DataQualityPanel", () => {
  it("renders the computed coverage once data loads", async () => {
    render(
      <FilterProvider>
        <DataQualityPanel />
      </FilterProvider>
    );

    expect(screen.getByRole("status", { name: "Loading data quality" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Coverage:/)).toBeInTheDocument());
  });
});
