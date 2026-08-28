import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterProvider } from "../context/FilterContext";
import MapView from "../components/MapView";
import { getMapRoutes } from "../api/client";
import type { MapEdge } from "../api/types";

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
  getMapRoutes: vi.fn(),
}));

function renderMapView() {
  return render(
    <FilterProvider>
      <MapView />
    </FilterProvider>
  );
}

describe("MapView", () => {
  it("shows an honest empty state when no real route data exists yet", async () => {
    vi.mocked(getMapRoutes).mockResolvedValue({
      snapshot_id: null,
      frequency: "daily",
      period: null,
      is_preview: false,
      edges: [],
    });

    renderMapView();

    await waitFor(() => expect(screen.getByText("Selected city")).toBeInTheDocument());
    expect(screen.getByText("Click a city on the map to see its route coverage.")).toBeInTheDocument();
  });

  it("shows an error message when the map data fetch fails", async () => {
    vi.mocked(getMapRoutes).mockRejectedValue(new Error("map fetch failed"));

    renderMapView();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to load route data: map fetch failed")
    );
  });

  it("selects a city on click and shows its real connected routes", async () => {
    vi.mocked(getMapRoutes).mockResolvedValue({
      snapshot_id: "snap-1",
      frequency: "daily",
      period: "2026-08-28",
      is_preview: false,
      edges: [
        {
          edge_key: "BOM|DEL",
          city_a: "BOM",
          city_b: "DEL",
          city_a_to_b: {
            snapshot_id: "snap-1",
            frequency: "daily",
            period: "2026-08-28",
            base_period: "2025-08-28",
            route_key: "BOM-DEL",
            origin_city_code: "BOM",
            destination_city_code: "DEL",
            cpi: 104.2,
            quote_count: 10,
            available_count: 10,
            no_flight_count: 0,
            source_count: 1,
            written_at: "2026-08-28T00:00:00+00:00",
          },
          city_b_to_a: null,
        },
      ],
    });

    renderMapView();
    await waitFor(() => expect(screen.getByText("Selected city")).toBeInTheDocument());

    // Clicking Mumbai (city_a of the fixture edge): its direction is
    // city_a_to_b, the one populated with real data in this fixture.
    await userEvent.click(screen.getByText("Mumbai"));

    // "Delhi"/"Mumbai" each appear twice once selected (once as a map marker
    // label, once in the detail panel) -- the CPI value only ever appears in
    // the detail panel, so it's the unambiguous proof the click wired through
    // to the real route data.
    expect(screen.getAllByText("Delhi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mumbai").length).toBeGreaterThan(0);
    expect(screen.getByText("104.2")).toBeInTheDocument();
  });

  it("falls back to visibly-labeled preview data only when real data is empty", async () => {
    const PREVIEW_EDGE: MapEdge = {
      edge_key: "BOM|DEL",
      city_a: "BOM",
      city_b: "DEL",
      city_a_to_b: {
        snapshot_id: "demo-map-daily-2026-08-27",
        frequency: "daily",
        period: "2026-08-27",
        base_period: "2025-08-27",
        route_key: "BOM-DEL",
        origin_city_code: "BOM",
        destination_city_code: "DEL",
        cpi: 119.8,
        quote_count: 218,
        available_count: 218,
        no_flight_count: 0,
        source_count: 1,
        written_at: "2026-08-27T00:00:00+00:00",
      },
      city_b_to_a: null,
    };

    vi.mocked(getMapRoutes).mockImplementation((params) =>
      Promise.resolve(
        params.preview
          ? { snapshot_id: "demo-map-daily-2026-08-27", frequency: "daily", period: "2026-08-27", is_preview: true, edges: [PREVIEW_EDGE] }
          : { snapshot_id: null, frequency: "daily", period: null, is_preview: false, edges: [] }
      )
    );

    renderMapView();

    await waitFor(() =>
      expect(screen.getByText("Preview data -- illustrative, not yet live")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByText("Mumbai"));
    expect(screen.getByText("119.8")).toBeInTheDocument();
  });

  it("does not show the preview label when real data exists", async () => {
    vi.mocked(getMapRoutes).mockResolvedValue({
      snapshot_id: "snap-1",
      frequency: "daily",
      period: "2026-08-28",
      is_preview: false,
      edges: [],
    });

    renderMapView();

    await waitFor(() => expect(screen.getByText("Selected city")).toBeInTheDocument());
    expect(screen.queryByText("Preview data -- illustrative, not yet live")).not.toBeInTheDocument();
  });

  it("shows 'no route coverage' for a city with no connected edges", async () => {
    vi.mocked(getMapRoutes).mockResolvedValue({
      snapshot_id: "snap-1",
      frequency: "daily",
      period: "2026-08-28",
      is_preview: false,
      edges: [],
    });

    renderMapView();
    await waitFor(() => expect(screen.getByText("Selected city")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Chennai"));

    expect(screen.getByText("No route coverage for this city yet.")).toBeInTheDocument();
  });
});
