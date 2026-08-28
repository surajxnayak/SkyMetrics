import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import SectorHeatmap from "../components/SectorHeatmap";

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
      fare_class: "T3",
      total_fare: 9000,
      status: "available",
      is_outlier: false,
      collected_at: "2026-08-24T11:00:00+00:00",
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
      collected_at: "2026-08-24T12:00:00+00:00",
    },
  ]),
}));

describe("SectorHeatmap", () => {
  it("renders a route row with the mean fare for the period, excluding outliers", async () => {
    render(
      <FilterProvider>
        <SectorHeatmap />
      </FilterProvider>
    );

    expect(screen.getByRole("status", { name: "Loading Sector heatmap" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("DEL-BOM")).toBeInTheDocument());
    expect(screen.getByText("8000")).toBeInTheDocument();
  });
});

describe("aggregate", () => {
  it("excludes records that don't match the given carrier, advance window, or fare class", async () => {
    const { aggregate } = await import("../components/SectorHeatmap");
    const records = [
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
        carrier: "6E",
        source: "other",
        advance_window: "T+1",
        fare_class: "U1",
        total_fare: 5000,
        status: "available",
        is_outlier: false,
        collected_at: "2026-08-24T10:00:00+00:00",
      },
    ];

    const cells = aggregate(records, {
      carrier: "QP",
      advanceWindow: "",
      fareClass: "",
      sources: ["akasaair"],
    });

    expect(cells).toHaveLength(1);
    expect(cells[0].meanFare).toBe(7000);
  });
});
