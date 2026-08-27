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
  ]),
}));

describe("TrendView", () => {
  it("shows the selected route once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    expect(screen.getByText("Loading trend data...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Route: DEL-BOM/)).toBeInTheDocument());
  });

  it("renders an export button once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });

  it("plots the mean fare trend line", async () => {
    const { container } = render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());

    expect(screen.getByText("Mean fare")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(1);
  });
});
