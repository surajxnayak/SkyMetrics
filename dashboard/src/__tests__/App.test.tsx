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
      advance_window: "T+1",
      fare_class: "U1",
      total_fare: 7000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T10:00:00+00:00",
    },
  ]),
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

    expect(screen.getByText("SkyMetrics APIx Dashboard")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());
  });

  it("switches to the heatmap tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Heatmap"));

    await waitFor(() => expect(screen.getByText("Sector heatmap")).toBeInTheDocument());
  });

  it("switches to the elasticity tab when clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Elasticity"));

    await waitFor(() => expect(screen.getByText("Lead-time elasticity")).toBeInTheDocument());
  });
});
