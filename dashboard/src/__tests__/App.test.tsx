import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

vi.mock("../api/client", () => ({
  getIndex: vi.fn().mockResolvedValue({
    comparison_id: "abc",
    frequency: "daily",
    series: [{ period: "2026-08-24", base_period: "2026-08-24", routes: ["DEL-BOM"], simple_relative: 100.0 }],
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
  ]),
  getFareRecords: vi.fn().mockResolvedValue({
    mean_total_fare: 7000,
    records: [
      {
        quote_id: "q1",
        collected_at: "2026-08-24T10:00:00+00:00",
        travel_date: "2026-09-01",
        route: "DEL-BOM",
        source: "akasaair",
        carrier: "QP",
        advance_window: "T+1",
        fare_class: "U1",
        routing: null,
        status: "available",
        is_outlier: false,
        total_fare: 7000,
        delta_from_mean: 0,
      },
    ],
  }),
  getMetadata: vi.fn().mockResolvedValue({
    weights: {
      source: "test",
      period: "2025",
      computed_at: "2026-08-24",
      weights: { "DEL-BOM": 1 },
    },
    formulas: {},
    snapshots: [],
  }),
}));

describe("App", () => {
  it("renders the dashboard title and defaults to the trend tab", async () => {
    render(<App />);

    expect(screen.getByText("SkyMetrics")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());
  });

  it("switches to the heatmap tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Sector Heatmap"));

    await waitFor(() => expect(screen.getByText("Sector heatmap")).toBeInTheDocument());
  });

  it("switches to the elasticity tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Elasticity"));

    await waitFor(() => expect(screen.getByText("Lead-time elasticity")).toBeInTheDocument());
  });

  it("switches to the list tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Data Drill-down"));

    await waitFor(() => expect(screen.getByText("List view")).toBeInTheDocument());
  });

  it("uses the correct ARIA tab pattern", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const trendTab = screen.getByRole("tab", { name: "Trend Analysis" });
    const heatmapTab = screen.getByRole("tab", { name: "Sector Heatmap" });
    expect(trendTab).toHaveAttribute("aria-selected", "true");
    expect(heatmapTab).toHaveAttribute("aria-selected", "false");

    await userEvent.click(heatmapTab);

    expect(trendTab).toHaveAttribute("aria-selected", "false");
    expect(heatmapTab).toHaveAttribute("aria-selected", "true");
  });
});
