import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import TrendView from "../components/TrendView";

vi.mock("../api/client", () => ({
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

    expect(screen.getByRole("status", { name: "Loading Trend view" })).toBeInTheDocument();
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

    expect(screen.getByText("DEL-BOM")).toBeInTheDocument();
    expect(screen.getByText("DEL-BLR")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });
});
