import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import TrendView from "../components/TrendView";

vi.mock("../api/client", () => ({
  getFares: vi.fn().mockResolvedValue([
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
      advance_window: "T+7",
      fare_class: "U1",
      total_fare: 9000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T11:00:00+00:00",
    },
    {
      origin: "DEL",
      destination: "BLR",
      carrier: "QP",
      source: "akasaair",
      advance_window: "T+1",
      fare_class: "U1",
      total_fare: 6000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T10:00:00+00:00",
    },
  ]),
}));

describe("TrendView", () => {
  it("shows selected routes once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    expect(screen.getByText("Loading trend data...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Routes: DEL-BOM, DEL-BLR/)).toBeInTheDocument());
  });

  it("renders an export button once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });

  it("plots one mean fare trend line per route", async () => {
    const { container } = render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());

    // Exact count of 2, not just >0 -- one from the KPI card, one from
    // Recharts' Legend -- so this actually fails if the KPI row (this
    // task's only new logic) silently disappears, rather than passing
    // vacuously off the Legend alone.
    expect(screen.getAllByText("DEL-BOM")).toHaveLength(2);
    expect(screen.getAllByText("DEL-BLR")).toHaveLength(2);
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });

  it("shows the latest mean fare per route in the KPI row", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());

    // DEL-BOM: mean of 7000 and 9000 (same day) = 8000. DEL-BLR: 6000 only.
    expect(screen.getByText("₹8,000")).toBeInTheDocument();
    expect(screen.getByText("₹6,000")).toBeInTheDocument();
  });
});
