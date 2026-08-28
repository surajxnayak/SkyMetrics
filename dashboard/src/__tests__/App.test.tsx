import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

vi.mock("../components/IndiaMapView", () => ({
  default: () => <div>Route CPI map</div>,
}));

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
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("renders the landing title and interactive map", async () => {
    render(<App />);

    expect(screen.getAllByText("SkyMetrics").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());
    expect(screen.getAllByText("When Airfare Changes, Data Should Know").length).toBeGreaterThan(0);
  });

  it("opens the Desktop 5 style menu drawer from the dashboard menu button", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("heading", { name: "MENU" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DASHBOARD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SUPPORT" })).toBeInTheDocument();
  });

  it("opens heatmap in the separate analytics screen when its dashboard card is clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Heatmap" }));

    expect(screen.queryByText("Route CPI map")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FILTER" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "HEATMAP" })).toBeInTheDocument());
  });

  it("opens elasticity in the separate analytics screen when its dashboard card is clicked", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Elasticity" }));

    await waitFor(() => expect(screen.getByText("Lead-time elasticity")).toBeInTheDocument());
  });

  it("rotates dashboard cards before opening the list analytics screen", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Next dashboard card" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "List" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "List" }));

    await waitFor(() => expect(screen.getByText("List view")).toBeInTheDocument());
  });

  it("cycles between analytical views with the extreme side arrows", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Trends" }));
    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Next analytical view" }));

    await waitFor(() => expect(screen.getByRole("status", { name: "Loading Heatmap" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { name: "HEATMAP" })).toBeInTheDocument(), { timeout: 1000 });
  });

  it("expands the analytics filter dock from the top-left filter button", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: "Trends" }));
    await userEvent.click(screen.getByRole("button", { name: "FILTER" }));

    expect(screen.getByLabelText("Expanded filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Frequency")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });
});
