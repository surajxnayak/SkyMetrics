import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMapRoutes } from "../api/client";
import IndiaMapView from "../components/IndiaMapView";

vi.mock("react-simple-maps", () => ({
  ComposableMap: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="india-map">{children}</svg>
  ),
  Geographies: ({ children }: { children: (args: { geographies: Array<{ rsmKey: string }> }) => React.ReactNode }) =>
    children({ geographies: [{ rsmKey: "india" }] }),
  Geography: () => <path data-testid="geography" />,
  useMapContext: () => ({
    projection: ([longitude, latitude]: [number, number]) => [longitude * 10, latitude * -10],
  }),
  Marker: ({
    children,
    onClick,
    onKeyDown,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<SVGGElement>;
    onKeyDown?: React.KeyboardEventHandler<SVGGElement>;
    onMouseEnter?: React.MouseEventHandler<SVGGElement>;
    onMouseMove?: React.MouseEventHandler<SVGGElement>;
    onMouseLeave?: React.MouseEventHandler<SVGGElement>;
  }) => (
    <g
      data-testid="map-marker"
      onClick={onClick}
      onKeyDown={onKeyDown}
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders airport-city nodes and split bidirectional route CPI tooltip", async () => {
    const { container } = render(<IndiaMapView />);

    await waitFor(() =>
      expect(getMapRoutes).toHaveBeenCalledWith(expect.objectContaining({ originCity: "DEL" }))
    );
    expect(screen.getByLabelText("Route CPI map")).toBeInTheDocument();

    const routeHitbox = container.querySelector(".landing-map__route-hitbox");
    expect(routeHitbox).not.toBeNull();
    fireEvent.mouseEnter(routeHitbox as Element, { clientX: 20, clientY: 30 });

    expect(screen.getByText("DEL - BOM")).toBeInTheDocument();
    expect(screen.getByText("DEL -> BOM")).toBeInTheDocument();
    expect(screen.getByText("BOM -> DEL")).toBeInTheDocument();
    expect(screen.getByText("108.0")).toBeInTheDocument();
    expect(screen.getByText("99.0")).toBeInTheDocument();
  });

  it("refetches adjacent routes when a node is clicked", async () => {
    render(<IndiaMapView />);

    await waitFor(() =>
      expect(getMapRoutes).toHaveBeenCalledWith(expect.objectContaining({ originCity: "DEL" }))
    );

    fireEvent.click(screen.getAllByTestId("map-marker")[1]);

    await waitFor(() => expect(getMapRoutes).toHaveBeenCalledTimes(2));
    expect(vi.mocked(getMapRoutes).mock.calls[1][0]).toEqual(
      expect.objectContaining({ frequency: "daily", originCity: expect.any(String) })
    );
  });

  it("keeps the map visible when the CPI fetch fails", async () => {
    vi.mocked(getMapRoutes).mockRejectedValueOnce(new Error("Failed to fetch"));

    const { container } = render(<IndiaMapView />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to fetch"));
    expect(container.querySelectorAll(".landing-map__route")).toHaveLength(6);
    expect(container.querySelectorAll(".landing-map__route-hitbox")).toHaveLength(6);
  });
});
