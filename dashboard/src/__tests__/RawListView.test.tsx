import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import RawListView from "../components/RawListView";

vi.mock("../api/client", () => ({
  getFareRecords: vi.fn().mockResolvedValue({
    mean_total_fare: 8000,
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
        total_fare: 9000,
        delta_from_mean: 1000,
      },
      {
        quote_id: "q2",
        collected_at: "2026-08-24T11:00:00+00:00",
        travel_date: "2026-09-08",
        route: "DEL-BOM",
        source: "akasaair",
        carrier: "QP",
        advance_window: "T+7",
        fare_class: "U1",
        routing: null,
        status: "available",
        is_outlier: false,
        total_fare: 7000,
        delta_from_mean: -1000,
      },
    ],
  }),
}));

describe("RawListView", () => {
  it("renders the mean and signed price deltas", async () => {
    render(
      <FilterProvider>
        <RawListView />
      </FilterProvider>
    );

    expect(screen.getByRole("status", { name: "Loading List view" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("List view")).toBeInTheDocument());

    expect(screen.getByText(/Mean fare: INR 8,000/)).toBeInTheDocument();
    expect(screen.getByText("+INR 1,000")).toBeInTheDocument();
    expect(screen.getByText("-INR 1,000")).toBeInTheDocument();
  });
});
