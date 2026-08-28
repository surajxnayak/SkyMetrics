import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

// react-simple-maps does its own fetch() of the GeoJSON URL and real SVG
// geo-projection -- neither is meaningful in jsdom, so it's stubbed out
// with lightweight pass-throughs that keep Marker's onClick real.
vi.mock("react-simple-maps", () => ({
  ComposableMap: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Geographies: ({ children }: { children: (arg: { geographies: unknown[] }) => React.ReactNode }) =>
    <>{children({ geographies: [] })}</>,
  Geography: () => null,
  Marker: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    coordinates: [number, number];
  }) => (
    <g onClick={onClick} role="button">
      {children}
    </g>
  ),
  Line: () => null,
}));

vi.mock("../api/client", () => ({
  getMapRoutes: vi.fn().mockResolvedValue({ snapshot_id: null, frequency: "daily", period: null, edges: [] }),
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
  askQuestion: vi.fn().mockResolvedValue({ answer: "", tool_calls: [] }),
}));

describe("App", () => {
  it("renders the persistent left nav and defaults to the map tab -- no redirect", async () => {
    render(<App />);

    expect(screen.getByText("SkyMetrics")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );
    expect(screen.getByRole("tab", { name: "Route Map" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to the trend tab when clicked, same shell, no page change", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByText("Trend Analysis"));

    await waitFor(() => expect(screen.getByText("Trend view")).toBeInTheDocument());
    expect(screen.getByText("SkyMetrics")).toBeInTheDocument();
  });

  it("switches to the heatmap tab when clicked", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByText("Sector Heatmap"));

    await waitFor(() => expect(screen.getByText("Sector heatmap")).toBeInTheDocument());
  });

  it("switches to the elasticity tab when clicked", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByText("Elasticity"));

    await waitFor(() => expect(screen.getByText("Lead-time elasticity")).toBeInTheDocument());
  });

  it("switches to the list tab when clicked", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByText("Data Drill-down"));

    await waitFor(() => expect(screen.getByText("List view")).toBeInTheDocument());
  });

  it("uses the correct ARIA tab pattern", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const mapTab = screen.getByRole("tab", { name: "Route Map" });
    const heatmapTab = screen.getByRole("tab", { name: "Sector Heatmap" });
    expect(mapTab).toHaveAttribute("aria-selected", "true");
    expect(heatmapTab).toHaveAttribute("aria-selected", "false");

    await userEvent.click(heatmapTab);

    expect(mapTab).toHaveAttribute("aria-selected", "false");
    expect(heatmapTab).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the floating Ask APIx widget available on every tab", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("See India's airfares move in real time")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Open Ask APIx chat" }));
    await waitFor(() => expect(screen.getByText("Ask APIx")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Close Ask APIx chat" }));
    expect(screen.queryByText("Ask APIx")).not.toBeInTheDocument();
  });
});
