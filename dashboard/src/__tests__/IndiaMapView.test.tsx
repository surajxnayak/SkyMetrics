import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { getMapRoutes } from "../api/client";
import IndiaMapView from "../components/IndiaMapView";
import { FilterProvider } from "../context/FilterContext";

vi.mock("react-simple-maps", () => ({
  ComposableMap: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="india-map">{children}</svg>
  ),
  Geographies: ({ children }: { children: (args: { geographies: Array<{ rsmKey: string }> }) => React.ReactNode }) =>
    children({ geographies: [{ rsmKey: "india" }] }),
  Geography: () => <path data-testid="geography" />,
  Line: ({
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
  }: {
    onMouseEnter?: React.MouseEventHandler<SVGLineElement>;
    onMouseMove?: React.MouseEventHandler<SVGLineElement>;
    onMouseLeave?: React.MouseEventHandler<SVGLineElement>;
  }) => (
    <line
      data-testid="map-line"
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    />
  ),
  Marker: ({
    children,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
  }: {
    children: React.ReactNode;
    onMouseEnter?: React.MouseEventHandler<SVGGElement>;
    onMouseMove?: React.MouseEventHandler<SVGGElement>;
    onMouseLeave?: React.MouseEventHandler<SVGGElement>;
  }) => (
    <g
      data-testid="map-marker"
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </g>
  ),
}));

vi.mock("../api/client", () => ({
  getMapRoutes: vi.fn().mockResolvedValue({
    snapshot_id: "snapshot-1",
    frequency: "daily",
    period: "2026-08-24",
    edges: [
      {
        edge_key: "BOM|DEL",
        city_a: "BOM",
        city_b: "DEL",
        city_a_to_b: {
          snapshot_id: "snapshot-1",
          frequency: "daily",
          period: "2026-08-24",
          base_period: "2026-08-01",
          route_key: "BOM-DEL",
          origin_city_code: "BOM",
          destination_city_code: "DEL",
          cpi: 99,
          quote_count: 8,
          available_count: 8,
          no_flight_count: 0,
          source_count: 1,
          written_at: "2026-08-24T10:00:00+00:00",
        },
        city_b_to_a: {
          snapshot_id: "snapshot-1",
          frequency: "daily",
          period: "2026-08-24",
          base_period: "2026-08-01",
          route_key: "DEL-BOM",
          origin_city_code: "DEL",
          destination_city_code: "BOM",
          cpi: 108,
          quote_count: 12,
          available_count: 11,
          no_flight_count: 1,
          source_count: 2,
          written_at: "2026-08-24T10:00:00+00:00",
        },
      },
    ],
  }),
}));

describe("IndiaMapView", () => {
  it("renders airport-city nodes and split bidirectional route CPI tooltip", async () => {
    render(
      <FilterProvider>
        <IndiaMapView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Route CPI map")).toBeInTheDocument());
    expect(screen.getByText(/CPI period: 2026-08-24 \/ Nodes: \d+/)).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getAllByTestId("map-line")[0], { clientX: 20, clientY: 30 });

    expect(screen.getByText("DEL - BOM")).toBeInTheDocument();
    expect(screen.getByText("DEL -> BOM")).toBeInTheDocument();
    expect(screen.getByText("BOM -> DEL")).toBeInTheDocument();
    expect(screen.getByText("108.0")).toBeInTheDocument();
    expect(screen.getByText("99.0")).toBeInTheDocument();
  });

  it("keeps the map visible when the CPI fetch fails", async () => {
    vi.mocked(getMapRoutes).mockRejectedValueOnce(new Error("Failed to fetch"));

    render(
      <FilterProvider>
        <IndiaMapView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to fetch"));
    expect(screen.getByTestId("india-map")).toBeInTheDocument();
    expect(screen.getAllByTestId("map-line").length).toBeGreaterThan(0);
  });
});
